import { PrismaClient, SubType } from '@prisma/client';
import argon2 from 'argon2';

export class AdminService {
  constructor(private prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@aitrainer.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

    if (email !== adminEmail || password !== adminPassword) {
      throw { statusCode: 401, message: 'Invalid admin credentials' };
    }

    // Find or create admin user
    let admin = await this.prisma.user.findUnique({ where: { email } });
    if (!admin) {
      const passwordHash = await argon2.hash(password);
      admin = await this.prisma.user.create({
        data: { email, passwordHash, name: 'Admin', role: 'ADMIN' },
      });
    }

    return { id: admin.id, email: admin.email, role: admin.role };
  }

  async getUsers(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
          role: 'USER' as const,
        }
      : { role: 'USER' as const };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          subscription: {
            select: { type: true, tokensUsed: true, tokensLimit: true, expiresAt: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateSubscription(userId: string, type: SubType, tokensLimit?: number) {
    const limits: Record<SubType, number> = {
      TRIAL: 10000,
      FREE: 20000,
      PRO: 100000,
    };

    return this.prisma.subscription.upsert({
      where: { userId },
      update: {
        type,
        tokensLimit: tokensLimit ?? limits[type],
        ...(type === 'PRO' && { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
      },
      create: {
        userId,
        type,
        tokensLimit: tokensLimit ?? limits[type],
      },
    });
  }

  async deleteUser(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }

  async getStats() {
    const [totalUsers, proUsers, totalMessages] = await Promise.all([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.subscription.count({ where: { type: 'PRO' } }),
      this.prisma.message.count(),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await this.prisma.user.count({
      where: { role: 'USER', updatedAt: { gte: thirtyDaysAgo } },
    });

    return { totalUsers, activeUsers, proUsers, totalMessages };
  }
}
