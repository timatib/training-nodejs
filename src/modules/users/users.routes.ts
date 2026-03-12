import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function usersRoutes(fastify: FastifyInstance) {
  const service = new UsersService(fastify.prisma);
  const controller = new UsersController(service);

  fastify.get('/me', { preHandler: [authGuard] }, (req, reply) => controller.getMe(req, reply));
  fastify.patch('/me', { preHandler: [authGuard] }, (req, reply) => controller.updateMe(req, reply));
  fastify.post('/me/avatar', { preHandler: [authGuard] }, (req, reply) => controller.uploadAvatar(req, reply));
}
