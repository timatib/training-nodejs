import { FastifyInstance } from 'fastify';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { authGuard } from '../../shared/guards/auth.guard';

export async function calendarRoutes(fastify: FastifyInstance) {
  const service = new CalendarService(fastify.prisma);
  const controller = new CalendarController(service);

  fastify.get('/', { preHandler: [authGuard] }, (req, reply) => controller.getMonthWorkouts(req, reply));
}
