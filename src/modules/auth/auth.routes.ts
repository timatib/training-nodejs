import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.prisma);
  const controller = new AuthController(authService);

  fastify.post('/register', (req, reply) => controller.register(req, reply));
  fastify.post('/login', (req, reply) => controller.login(req, reply));
  fastify.post('/refresh', (req, reply) => controller.refresh(req, reply));
  fastify.post('/logout', (req, reply) => controller.logout(req, reply));
  fastify.post('/forgot-password', (req, reply) => controller.forgotPassword(req, reply));
  fastify.post('/change-password', { preHandler: [authGuard] }, (req, reply) => controller.changePassword(req, reply));
}
