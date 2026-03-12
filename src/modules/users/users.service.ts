import { PrismaClient } from '@prisma/client';
import { UpdateProfileDto } from './users.schema';

export class UsersService {
  constructor(private prisma: PrismaClient) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        slogan: true,
        gender: true,
        age: true,
        weight: true,
        height: true,
        fitnessLevel: true,
        goal: true,
        aiStyle: true,
        theme: true,
        language: true,
        workoutPlace: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            type: true,
            tokensUsed: true,
            tokensLimit: true,
            expiresAt: true,
          },
        },
        streaks: {
          select: {
            currentDays: true,
            maxDays: true,
            waterDrops: true,
            lastDate: true,
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        slogan: true,
        gender: true,
        age: true,
        weight: true,
        height: true,
        fitnessLevel: true,
        goal: true,
        aiStyle: true,
        theme: true,
        language: true,
        workoutPlace: true,
      },
    });

    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }
}
