import { FastifyRequest, FastifyReply } from 'fastify';
import { WorkoutsService } from './workouts.service';
import { createWorkoutSchema, updateWorkoutSchema } from './workouts.schema';
import { JwtPayload } from '../../shared/types';

export class WorkoutsController {
  constructor(private service: WorkoutsService) {}

  async getWorkouts(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const workouts = await this.service.getWorkouts(user.userId);
    return reply.send(workouts);
  }

  async getWorkout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      const workout = await this.service.getWorkout(user.userId, id);
      return reply.send(workout);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async createWorkout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = createWorkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const workout = await this.service.createWorkout(user.userId, parsed.data);
    return reply.status(201).send(workout);
  }

  async updateWorkout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = updateWorkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const workout = await this.service.updateWorkout(user.userId, id, parsed.data);
      return reply.send(workout);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async completeWorkout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      const workout = await this.service.completeWorkout(user.userId, id);
      return reply.send(workout);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }
}
