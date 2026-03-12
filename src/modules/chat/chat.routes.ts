import { FastifyInstance } from 'fastify';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function chatRoutes(fastify: FastifyInstance) {
  const service = new ChatService(fastify.prisma);
  const controller = new ChatController(service);

  fastify.get('/messages', { preHandler: [authGuard] }, (req, reply) => controller.getMessages(req, reply));
  fastify.post('/message', { preHandler: [authGuard] }, (req, reply) => controller.sendMessage(req, reply));
  fastify.delete('/messages', { preHandler: [authGuard] }, (req, reply) => controller.clearHistory(req, reply));
}
