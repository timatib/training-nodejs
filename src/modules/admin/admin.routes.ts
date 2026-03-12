import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { adminGuard } from '../../shared/guards/auth.guard';

export async function adminRoutes(fastify: FastifyInstance) {
  const service = new AdminService(fastify.prisma);
  const controller = new AdminController(service);

  // Public admin login
  fastify.post('/login', (req, reply) => controller.login(req, reply));

  // Protected admin routes
  fastify.get('/users', { preHandler: [adminGuard] }, (req, reply) => controller.getUsers(req, reply));
  fastify.patch('/users/:id/subscription', { preHandler: [adminGuard] }, (req, reply) => controller.updateSubscription(req, reply));
  fastify.delete('/users/:id', { preHandler: [adminGuard] }, (req, reply) => controller.deleteUser(req, reply));
  fastify.get('/stats', { preHandler: [adminGuard] }, (req, reply) => controller.getStats(req, reply));
}
