import { FastifyInstance } from 'fastify';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function subscriptionsRoutes(fastify: FastifyInstance) {
  const service = new SubscriptionsService(fastify.prisma);
  const controller = new SubscriptionsController(service);

  fastify.get('/current', { preHandler: [authGuard] }, (req, reply) => controller.getCurrent(req, reply));
  fastify.post('/upgrade', { preHandler: [authGuard] }, (req, reply) => controller.upgrade(req, reply));
}
