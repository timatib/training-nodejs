import { FastifyInstance } from 'fastify';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function nutritionRoutes(fastify: FastifyInstance) {
  const service = new NutritionService(fastify.prisma);
  const controller = new NutritionController(service);

  fastify.get('/', { preHandler: [authGuard] }, (req, reply) => controller.getLogs(req, reply));
  fastify.post('/log', { preHandler: [authGuard] }, (req, reply) => controller.logMeal(req, reply));
  fastify.get('/daily-summary', { preHandler: [authGuard] }, (req, reply) => controller.getDailySummary(req, reply));
}
