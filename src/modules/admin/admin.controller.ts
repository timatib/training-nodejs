import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateSubSchema = z.object({
  type: z.enum(['TRIAL', 'FREE', 'PRO']),
  tokensLimit: z.number().optional(),
});

export class AdminController {
  constructor(private service: AdminService) {}

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const admin = await this.service.login(parsed.data.email, parsed.data.password);

      const accessToken = await reply.jwtSign(
        { userId: admin.id, email: admin.email, role: admin.role },
        { expiresIn: '8h' }
      );

      return reply.send({ accessToken, admin });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const { page = '1', limit = '20', search } = request.query as {
      page?: string;
      limit?: string;
      search?: string;
    };

    const result = await this.service.getUsers(parseInt(page), parseInt(limit), search);
    return reply.send(result);
  }

  async updateSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parsed = updateSubSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const sub = await this.service.updateSubscription(id, parsed.data.type, parsed.data.tokensLimit);
      return reply.send(sub);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const result = await this.service.deleteUser(id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.service.getStats();
    return reply.send(stats);
  }
}
