import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { AddProgressDto } from './progress.schema';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class ProgressService {
  constructor(private prisma: PrismaClient) {}

  async getLogs(userId: string) {
    return this.prisma.progressLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addLog(userId: string, dto: AddProgressDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, goal: true },
    });

    let aiResponse = '';

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Ты персональный тренер. Пользователь описывает свой прогресс.
Имя: ${user?.name || 'Пользователь'}
Цель: ${user?.goal || 'не указана'}

Прогресс: ${dto.note}

Дай краткую, мотивирующую обратную связь (2-3 предложения). Оцени насколько пользователь близок к цели.`,
          },
        ],
      });

      aiResponse = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      aiResponse = 'Отличная работа! Продолжай в том же духе!';
    }

    return this.prisma.progressLog.create({
      data: { userId, note: dto.note, aiResponse },
    });
  }

  async getStreak(userId: string) {
    const streak = await this.prisma.streak.findUnique({ where: { userId } });
    return streak || { currentDays: 0, maxDays: 0, waterDrops: 0, lastDate: null };
  }
}
