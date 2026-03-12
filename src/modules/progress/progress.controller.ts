import { FastifyRequest, FastifyReply } from 'fastify';
import { ProgressService } from './progress.service';
import { addProgressSchema } from './progress.schema';
import { JwtPayload } from '../../shared/types';

export class ProgressController {
  constructor(private service: ProgressService) {}

  async getLogs(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const logs = await this.service.getLogs(user.userId);
    return reply.send(logs);
  }

  async addLog(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = addProgressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const log = await this.service.addLog(user.userId, parsed.data);
    return reply.status(201).send(log);
  }

  async getStreak(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const streak = await this.service.getStreak(user.userId);
    return reply.send(streak);
  }
}
