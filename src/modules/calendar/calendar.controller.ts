import { FastifyRequest, FastifyReply } from 'fastify';
import { CalendarService } from './calendar.service';
import { JwtPayload } from '../../shared/types';

export class CalendarController {
  constructor(private service: CalendarService) {}

  async getMonthWorkouts(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const { month } = request.query as { month?: string };

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const workouts = await this.service.getMonthWorkouts(user.userId, targetMonth);
    return reply.send(workouts);
  }
}
