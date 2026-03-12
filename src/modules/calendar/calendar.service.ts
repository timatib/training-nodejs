import { PrismaClient } from '@prisma/client';

export class CalendarService {
  constructor(private prisma: PrismaClient) {}

  async getMonthWorkouts(userId: string, month: string) {
    // month format: "2024-01"
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    return this.prisma.workoutPlan.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }
}
