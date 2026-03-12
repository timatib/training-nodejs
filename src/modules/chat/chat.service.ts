import { PrismaClient, User, AiStyle, MessageRole } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(user: Partial<User>): string {
  const styleDescriptions: Record<AiStyle, string> = {
    STRICT: 'Отвечай жёстко, как строгий военный тренер. Не давай спуску, требуй дисциплины.',
    NORMAL: 'Отвечай дружески и поддерживающе, как хороший друг-тренер.',
    FUN: 'Отвечай с юмором, шутками и лёгкими подколами, но оставайся полезным.',
  };

  const genderMap: Record<string, string> = {
    MALE: 'мужской',
    FEMALE: 'женский',
    OTHER: 'не указан',
  };

  const fitnessLevelMap: Record<string, string> = {
    BEGINNER: 'начинающий',
    INTERMEDIATE: 'средний',
    ADVANCED: 'продвинутый',
  };

  const workoutPlaceMap: Record<string, string> = {
    GYM: 'зал',
    HOME: 'дома',
    OUTDOOR: 'на улице',
  };

  return `Ты — персональный ИИ-тренер по имени Макс. Ты помогаешь людям с тренировками, питанием и восстановлением.

Данные пользователя:
- Имя: ${user.name || 'не указано'}
- Возраст: ${user.age ? user.age + ' лет' : 'не указан'}
- Пол: ${user.gender ? genderMap[user.gender] : 'не указан'}
- Вес: ${user.weight ? user.weight + ' кг' : 'не указан'}, Рост: ${user.height ? user.height + ' см' : 'не указан'}
- Уровень: ${user.fitnessLevel ? fitnessLevelMap[user.fitnessLevel] : 'не указан'}
- Место тренировок: ${user.workoutPlace ? workoutPlaceMap[user.workoutPlace] : 'не указано'}
- Цель: ${user.goal || 'не указана'}
- Стиль общения: ${user.aiStyle || 'NORMAL'}

${styleDescriptions[user.aiStyle || 'NORMAL']}

Когда предлагаешь конкретное упражнение, ОБЯЗАТЕЛЬНО оборачивай его в JSON-блок:
{"type":"workout_card","exercise":"Название упражнения","sets":3,"reps":12,"icon":"squat"}

Возможные иконки: squat, pushup, run, bike, pull_up, plank, dumbbell, stretch, jump, swim

Если профиль пользователя не заполнен, тактично попроси предоставить нужные данные.
Всегда отвечай на языке пользователя (${user.language || 'ru'}).`;
}

function parseAIResponse(content: string): { text: string; workoutCards: any[] } {
  const workoutCards: any[] = [];
  const jsonRegex = /\{"type":"workout_card"[^}]+\}/g;
  const matches = content.match(jsonRegex) || [];

  for (const match of matches) {
    try {
      const card = JSON.parse(match);
      workoutCards.push(card);
    } catch {
      // ignore invalid JSON
    }
  }

  const cleanText = content.replace(jsonRegex, '').trim();
  return { text: cleanText, workoutCards };
}

export class ChatService {
  constructor(private prisma: PrismaClient) {}

  async getMessages(userId: string, limit = 50, offset = 0) {
    return this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });
  }

  async sendMessage(userId: string, content: string) {
    // Check subscription token limit
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (subscription && subscription.tokensUsed >= subscription.tokensLimit) {
      throw { statusCode: 403, message: 'Token limit exceeded. Please upgrade your subscription.' };
    }

    // Get user profile for system prompt
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    // Save user message
    await this.prisma.message.create({
      data: {
        userId,
        role: 'USER',
        content,
        type: 'TEXT',
      },
    });

    // Get conversation history (last 20 messages)
    const history = await this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(user),
      messages,
    });

    const aiContent = response.content[0].type === 'text' ? response.content[0].text : '';
    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;

    // Update token usage
    if (subscription) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { tokensUsed: { increment: totalTokens } },
      });
    }

    // Parse response for workout cards
    const { text: cleanText, workoutCards } = parseAIResponse(aiContent);

    // Save AI message
    const messageType = workoutCards.length > 0 ? 'WORKOUT_CARD' : 'TEXT';
    const savedMessage = await this.prisma.message.create({
      data: {
        userId,
        role: 'ASSISTANT',
        content: cleanText,
        type: messageType,
        metadata: workoutCards.length > 0 ? { workoutCards } : undefined,
      },
    });

    // Check if we should create workout plans from the response
    await this.tryCreateWorkoutPlans(userId, aiContent, user);

    return {
      message: savedMessage,
      tokensUsed: totalTokens,
      subscriptionWarning: subscription &&
        subscription.tokensUsed + totalTokens >= subscription.tokensLimit * 0.8
        ? 'You have used 80% of your token limit'
        : undefined,
    };
  }

  private async tryCreateWorkoutPlans(userId: string, content: string, user: any) {
    // Look for workout schedule JSON blocks
    const scheduleRegex = /\{"type":"workout_schedule"[^}]+\}/g;
    const matches = content.match(scheduleRegex) || [];

    for (const match of matches) {
      try {
        const schedule = JSON.parse(match);
        if (schedule.workouts && Array.isArray(schedule.workouts)) {
          for (const workout of schedule.workouts) {
            await this.prisma.workoutPlan.create({
              data: {
                userId,
                title: workout.title || 'Тренировка',
                date: new Date(workout.date),
                place: user.workoutPlace || 'HOME',
                exercises: workout.exercises || [],
              },
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  async clearHistory(userId: string) {
    await this.prisma.message.deleteMany({ where: { userId } });
    return { message: 'Chat history cleared' };
  }
}
