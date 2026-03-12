import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info('Redis connected');
  } catch (err) {
    fastify.log.warn('Redis connection failed, rate limiting will be disabled');
  }

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});

export default redisPlugin;
