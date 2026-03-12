import { FastifyInstance } from 'fastify';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function workoutsRoutes(fastify: FastifyInstance) {
  const service = new WorkoutsService(fastify.prisma);
  const controller = new WorkoutsController(service);

  fastify.get('/', { preHandler: [authGuard] }, (req, reply) => controller.getWorkouts(req, reply));
  fastify.post('/', { preHandler: [authGuard] }, (req, reply) => controller.createWorkout(req, reply));
  fastify.get('/:id', { preHandler: [authGuard] }, (req, reply) => controller.getWorkout(req, reply));
  fastify.patch('/:id', { preHandler: [authGuard] }, (req, reply) => controller.updateWorkout(req, reply));
  fastify.patch('/:id/complete', { preHandler: [authGuard] }, (req, reply) => controller.completeWorkout(req, reply));
}
