import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import fs from 'fs';

// Plugins
import prismaPlugin from './plugins/prisma.plugin';
import redisPlugin from './plugins/redis.plugin';

// Routes
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { chatRoutes } from './modules/chat/chat.routes';
import { workoutsRoutes } from './modules/workouts/workouts.routes';
import { calendarRoutes } from './modules/calendar/calendar.routes';
import { nutritionRoutes } from './modules/nutrition/nutrition.routes';
import { progressRoutes } from './modules/progress/progress.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { adminRoutes } from './modules/admin/admin.routes';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

async function bootstrap() {
  // Security
  await app.register(helmet, { global: true });

  await app.register(cors, {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:8081',
      process.env.ADMIN_URL || 'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookie
  await app.register(cookie, {
    secret: process.env.JWT_SECRET || 'cookie-secret',
  });

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'jwt-secret-key-minimum-32-chars!!',
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  });

  // Multipart (file uploads)
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Database & Cache
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Static files for uploaded avatars
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(workoutsRoutes, { prefix: '/api/workouts' });
  await app.register(calendarRoutes, { prefix: '/api/calendar' });
  await app.register(nutritionRoutes, { prefix: '/api/nutrition' });
  await app.register(progressRoutes, { prefix: '/api/progress' });
  await app.register(subscriptionsRoutes, { prefix: '/api/subscriptions' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Something went wrong',
    });
  });

  const port = parseInt(process.env.PORT || '3000');
  const host = '0.0.0.0';

  await app.listen({ port, host });
  console.log(`🚀 AI Trainer API running at http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
