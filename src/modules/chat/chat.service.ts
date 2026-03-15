import { PrismaClient, User, AiStyle } from '@prisma/client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

Если профиль пользователя не заполнен, тактично попроси предоставить нужные данные.
Всегда отвечай на языке пользователя (${user.language || 'ru'}).

Форматируй ответы в Markdown. Используй: **жирный**, списки (- или 1.), переносы строк. Не используй заголовки (# ## ###).`;
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
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (subscription && subscription.tokensUsed >= subscription.tokensLimit) {
      throw { statusCode: 403, message: 'Token limit exceeded. Please upgrade your subscription.' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    await this.prisma.message.create({
      data: { userId, role: 'USER', content, type: 'TEXT' },
    });

    const history = await this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(user) },
      ...history.map((m) => ({
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages,
    });

    const aiContent = response.choices[0].message.content || '';
    const totalTokens = (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);

    if (subscription) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { tokensUsed: { increment: totalTokens } },
      });
    }

    const savedMessage = await this.prisma.message.create({
      data: { userId, role: 'ASSISTANT', content: aiContent, type: 'TEXT' },
    });

    return {
      message: savedMessage,
      tokensUsed: totalTokens,
      subscriptionWarning: subscription &&
        subscription.tokensUsed + totalTokens >= subscription.tokensLimit * 0.8
        ? 'You have used 80% of your token limit'
        : undefined,
    };
  }

  async clearHistory(userId: string) {
    await this.prisma.message.deleteMany({ where: { userId } });
    return { message: 'Chat history cleared' };
  }
}
