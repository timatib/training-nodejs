import { FastifyInstance } from 'fastify';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function progressRoutes(fastify: FastifyInstance) {
  const service = new ProgressService(fastify.prisma);
  const controller = new ProgressController(service);

  fastify.get('/', { preHandler: [authGuard] }, (req, reply) => controller.getLogs(req, reply));
  fastify.post('/', { preHandler: [authGuard] }, (req, reply) => controller.addLog(req, reply));
  fastify.get('/streak', { preHandler: [authGuard] }, (req, reply) => controller.getStreak(req, reply));
}
