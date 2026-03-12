import { PrismaClient } from '@prisma/client';
import { CreateWorkoutDto, UpdateWorkoutDto } from './workouts.schema';

export class WorkoutsService {
  constructor(private prisma: PrismaClient) {}

  async getWorkouts(userId: string) {
    return this.prisma.workoutPlan.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  async getWorkout(userId: string, id: string) {
    const workout = await this.prisma.workoutPlan.findFirst({
      where: { id, userId },
    });
    if (!workout) throw { statusCode: 404, message: 'Workout not found' };
    return workout;
  }

  async createWorkout(userId: string, dto: CreateWorkoutDto) {
    return this.prisma.workoutPlan.create({
      data: {
        userId,
        title: dto.title,
        date: new Date(dto.date),
        place: dto.place,
        exercises: dto.exercises,
      },
    });
  }

  async updateWorkout(userId: string, id: string, dto: UpdateWorkoutDto) {
    const workout = await this.prisma.workoutPlan.findFirst({ where: { id, userId } });
    if (!workout) throw { statusCode: 404, message: 'Workout not found' };

    return this.prisma.workoutPlan.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.place && { place: dto.place }),
        ...(dto.exercises && { exercises: dto.exercises }),
      },
    });
  }

  async completeWorkout(userId: string, id: string) {
    const workout = await this.prisma.workoutPlan.findFirst({ where: { id, userId } });
    if (!workout) throw { statusCode: 404, message: 'Workout not found' };

    const updated = await this.prisma.workoutPlan.update({
      where: { id },
      data: { completed: true },
    });

    // Update streak
    await this.updateStreak(userId);

    return updated;
  }

  private async updateStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await this.prisma.streak.findUnique({ where: { userId } });

    if (!streak) {
      await this.prisma.streak.create({
        data: { userId, currentDays: 1, maxDays: 1, lastDate: today, waterDrops: 1 },
      });
      return;
    }

    const lastDate = streak.lastDate ? new Date(streak.lastDate) : null;
    if (lastDate) {
      lastDate.setHours(0, 0, 0, 0);
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newCurrentDays = streak.currentDays;

    if (!lastDate || lastDate.getTime() < yesterday.getTime()) {
      // Reset streak
      newCurrentDays = 1;
    } else if (lastDate.getTime() === yesterday.getTime()) {
      // Continue streak
      newCurrentDays = streak.currentDays + 1;
    } else if (lastDate.getTime() === today.getTime()) {
      // Already updated today
      return;
    }

    const newMaxDays = Math.max(newCurrentDays, streak.maxDays);

    await this.prisma.streak.update({
      where: { userId },
      data: {
        currentDays: newCurrentDays,
        maxDays: newMaxDays,
        lastDate: today,
        waterDrops: { increment: 1 },
      },
    });
  }
}
