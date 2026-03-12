import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionsService } from './subscriptions.service';
import { JwtPayload } from '../../shared/types';

export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  async getCurrent(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    try {
      const sub = await this.service.getCurrent(user.userId);
      return reply.send(sub);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async upgrade(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const sub = await this.service.upgrade(user.userId);
    return reply.send(sub);
  }
}
