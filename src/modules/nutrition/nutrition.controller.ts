import { FastifyRequest, FastifyReply } from 'fastify';
import { NutritionService } from './nutrition.service';
import { logMealSchema } from './nutrition.schema';
import { JwtPayload } from '../../shared/types';

export class NutritionController {
  constructor(private service: NutritionService) {}

  async getLogs(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { date } = request.query as { date?: string };
    const logs = await this.service.getLogs(user.userId, date);
    return reply.send(logs);
  }

  async logMeal(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = logMealSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const log = await this.service.logMeal(user.userId, parsed.data);
    return reply.status(201).send(log);
  }

  async getDailySummary(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { date } = request.query as { date?: string };
    const summary = await this.service.getDailySummary(user.userId, date);
    return reply.send(summary);
  }
}
