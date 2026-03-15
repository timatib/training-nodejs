import { PrismaClient, User, AiStyle } from '@prisma/client';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDayOfWeek(dateStr: string): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  return days[new Date(dateStr).getDay()];
}

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(user: Partial<User>, workoutContext: string, todayStr: string, tomorrowStr: string): string {
  const styleDescriptions: Record<AiStyle, string> = {
    STRICT: 'Отвечай жёстко, как строгий военный тренер. Не давай спуску, требуй дисциплины.',
    NORMAL: 'Отвечай дружески и поддерживающе, как хороший друг-тренер.',
    FUN: 'Отвечай с юмором, шутками и лёгкими подколами, но оставайся полезным.',
  };

  const genderMap: Record<string, string> = {
    MALE: 'мужской', FEMALE: 'женский', OTHER: 'не указан',
  };
  const fitnessLevelMap: Record<string, string> = {
    BEGINNER: 'начинающий', INTERMEDIATE: 'средний', ADVANCED: 'продвинутый',
  };
  const workoutPlaceMap: Record<string, string> = {
    GYM: 'зал', HOME: 'дома', OUTDOOR: 'на улице',
  };

  return `Ты — персональный ИИ-тренер по имени Макс. Ты помогаешь людям с тренировками, питанием и восстановлением.

Текущая дата: ${todayStr} — ${getDayOfWeek(todayStr)} (завтра: ${tomorrowStr} — ${getDayOfWeek(tomorrowStr)}).
Послезавтра: ${getDateOffset(2)}, через 3 дня: ${getDateOffset(3)}, через 7 дней: ${getDateOffset(7)}.
Всегда вычисляй "следующий [день недели]" относительно сегодняшней даты (${todayStr}).

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
${workoutContext}
Если профиль пользователя не заполнен, тактично попроси предоставить нужные данные.
Всегда отвечай на языке пользователя (${user.language || 'ru'}).

Форматируй ответы в Markdown. Используй: **жирный**, списки (- или 1.), переносы строк. Не используй заголовки (# ## ###).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
СОЗДАНИЕ ТРЕНИРОВОК — ВАЖНО:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ты ОБЯЗАН добавить блок <SCHEDULE>[...]</SCHEDULE> В КОНЦЕ ответа, если пользователь:
- Просит создать / добавить / запланировать / составить тренировку (на сегодня, завтра, послезавтра, конкретный день или дату, на неделю)
- Упоминает группу мышц: "на спину", "на ноги", "на грудь", "на плечи", "на руки", "верхняя часть тела", "нижняя часть тела", "всё тело", "пресс", "кор"
- Упоминает тип активности: "кардио", "силовая", "функциональная", "растяжка", "йога", "HIIT", "круговая", "интервальная"
- Говорит: "давай потренируемся", "хочу потренироваться", "сделаем тренировку", "добавь в календарь", "поставь занятие"
- Называет конкретный день недели в контексте тренировки ("в пятницу сделай...", "на следующей неделе...")
- Просит план на несколько дней / неделю / месяц

Резолюция дат:
- "сегодня" → ${todayStr}
- "завтра" → ${tomorrowStr}
- "послезавтра" → ${getDateOffset(2)}
- "через N дней" → вычисли от ${todayStr}
- "в следующий понедельник" / "следующий пн" → ближайший понедельник после ${todayStr}
- "в эту пятницу" / "в пятницу" → ближайшая пятница (текущей или следующей недели)
- конкретная дата "20 марта", "March 20", "20.03" → YYYY-MM-DD текущего или следующего года

Правила подбора упражнений:
- Место по умолчанию: ${user.workoutPlace || 'HOME'} (менять только если пользователь явно указал другое)
- GYM → штанга, гантели, тренажёры, кабельные блоки, блок для тяги
- HOME → приседания, отжимания, планка, выпады, прыжки, гантели (если есть)
- OUTDOOR → бег, подтягивания, отжимания, прыжки, берпи, ходьба в гору
- BEGINNER (начинающий): 2-3 подхода × 8-12 повторений, базовые упражнения
- INTERMEDIATE (средний): 3-4 подхода × 8-15 повторений, суперсеты разрешены
- ADVANCED (продвинутый): 4-5 подходов, вариативность повторений, суперсеты, дроп-сеты
- Включай 5-8 упражнений на тренировку
- Если на указанную дату в расписании уже есть тренировка — уточни у пользователя

Формат блока (строго соблюдай):
<SCHEDULE>[{"title":"Название тренировки","date":"YYYY-MM-DD","place":"GYM","exercises":[{"name":"Упражнение","sets":3,"reps":12}]}]</SCHEDULE>

- Блок невидим пользователю — автоматически сохраняется в календарь
- Поле place: "GYM" | "HOME" | "OUTDOOR"
- Если план на несколько дней — включи все тренировки в один JSON-массив
- Дата строго в формате YYYY-MM-DD
- Упражнения с длительностью вместо повторений: используй поле "duration" (в минутах) вместо "reps"`;
}

// ─── SCHEDULE parser ──────────────────────────────────────────────────────────

function parseWorkoutSchedule(content: string): Array<{ title: string; date: string; place?: string; exercises: any[] }> {
  const match = content.match(/<SCHEDULE>([\s\S]*?)<\/SCHEDULE>/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

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

    // Current date strings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Load upcoming workouts for context (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingWorkouts = await this.prisma.workoutPlan.findMany({
      where: { userId, date: { gte: today, lte: nextWeek } },
      orderBy: { date: 'asc' },
    });

    let workoutContext = '';
    if (upcomingWorkouts.length > 0) {
      workoutContext = '\n\nРасписание тренировок пользователя на ближайшие 7 дней:\n';
      for (const w of upcomingWorkouts) {
        const dateStr = new Date(w.date).toISOString().slice(0, 10);
        const dayName = getDayOfWeek(dateStr);
        const status = w.completed ? 'выполнено' : 'запланировано';
        const exercises = (w.exercises as any[])
          .map((e: any) => `${e.name}${e.sets && e.reps ? ` ${e.sets}×${e.reps}` : ''}`)
          .join(', ');
        workoutContext += `- ${dateStr} (${dayName}): **${w.title}** (${status}) — ${exercises}\n`;
      }
      workoutContext += 'Если пользователь спрашивает о сегодняшней или предстоящей тренировке — используй это расписание.\n';
    }

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
      { role: 'system', content: buildSystemPrompt(user, workoutContext, todayStr, tomorrowStr) },
      ...history.map((m) => ({
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
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

    // Parse and save workout schedule from AI response
    const scheduleItems = parseWorkoutSchedule(aiContent);
    for (const item of scheduleItems) {
      try {
        await this.prisma.workoutPlan.create({
          data: {
            userId,
            title: item.title,
            date: new Date(item.date),
            place: (item.place as any) || user.workoutPlace || 'HOME',
            exercises: item.exercises || [],
          },
        });
      } catch {
        // ignore invalid entries
      }
    }

    // Strip SCHEDULE block before saving message
    const cleanContent = aiContent.replace(/<SCHEDULE>[\s\S]*?<\/SCHEDULE>/g, '').trim();

    const savedMessage = await this.prisma.message.create({
      data: { userId, role: 'ASSISTANT', content: cleanContent, type: 'TEXT' },
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

  async transcribeAudio(audioBuffer: Buffer, mimetype: string, language = 'ru') {
    const file = await toFile(audioBuffer, 'audio.m4a', { type: mimetype });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
    });
    return { text: transcription.text };
  }

  async clearHistory(userId: string) {
    await this.prisma.message.deleteMany({ where: { userId } });
    return { message: 'Chat history cleared' };
  }
}
