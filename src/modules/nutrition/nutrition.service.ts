import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { LogMealDto } from './nutrition.schema';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class NutritionService {
  constructor(private prisma: PrismaClient) {}

  async getLogs(userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return this.prisma.nutritionLog.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async logMeal(userId: string, dto: LogMealDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { weight: true, height: true, age: true, goal: true },
    });

    // Ask AI to analyze the meal
    let calories: number | undefined;
    let protein: number | undefined;
    let fat: number | undefined;
    let carbs: number | undefined;
    let aiAnalysis = '';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Проанализируй приём пищи и дай приблизительное КБЖУ. Ответь ТОЛЬКО в JSON формате без лишнего текста:
{"calories": number, "protein": number, "fat": number, "carbs": number, "comment": "краткий комментарий на русском"}

Приём пищи: ${dto.meal}`,
          },
        ],
      });

      const text = response.choices[0].message.content || '';
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        calories = data.calories;
        protein = data.protein;
        fat = data.fat;
        carbs = data.carbs;
        aiAnalysis = data.comment || '';
      }
    } catch (err) {
      console.error('AI nutrition analysis failed:', err);
      aiAnalysis = 'Не удалось проанализировать КБЖУ';
    }

    return this.prisma.nutritionLog.create({
      data: {
        userId,
        meal: dto.meal,
        calories,
        protein,
        fat,
        carbs,
        aiAnalysis,
      },
    });
  }

  async getDailySummary(userId: string, date?: string) {
    const logs = await this.getLogs(userId, date);

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        fat: acc.fat + (log.fat || 0),
        carbs: acc.carbs + (log.carbs || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    // Calculate daily calorie goal based on user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { weight: true, height: true, age: true, gender: true, goal: true },
    });

    let calorieGoal = 2000; // default
    if (user?.weight && user?.height && user?.age) {
      // Harris-Benedict formula
      let bmr: number;
      if (user.gender === 'MALE') {
        bmr = 88.362 + 13.397 * user.weight + 4.799 * user.height - 5.677 * user.age;
      } else {
        bmr = 447.593 + 9.247 * user.weight + 3.098 * user.height - 4.33 * user.age;
      }
      calorieGoal = Math.round(bmr * 1.375); // moderately active
    }

    return {
      date: date || new Date().toISOString().slice(0, 10),
      logs,
      totals,
      calorieGoal,
      remaining: Math.max(0, calorieGoal - totals.calories),
    };
  }
}
