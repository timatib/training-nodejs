import { PrismaClient } from '@prisma/client';

export class SubscriptionsService {
  constructor(private prisma: PrismaClient) {}

  async getCurrent(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw { statusCode: 404, message: 'Subscription not found' };
    return sub;
  }

  async upgrade(userId: string) {
    // Mock payment - in production integrate with Stripe/etc
    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        type: 'PRO',
        tokensLimit: 100000,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      create: {
        userId,
        type: 'PRO',
        tokensLimit: 100000,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return sub;
  }
}
