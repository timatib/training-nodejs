import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatService } from './chat.service';
import { sendMessageSchema } from './chat.schema';
import { JwtPayload } from '../../shared/types';

export class ChatController {
  constructor(private chatService: ChatService) {}

  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const query = request.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit || '50');
    const offset = parseInt(query.offset || '0');

    const messages = await this.chatService.getMessages(user.userId, limit, offset);
    return reply.send(messages);
  }

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const result = await this.chatService.sendMessage(user.userId, parsed.data.content);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async clearHistory(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const result = await this.chatService.clearHistory(user.userId);
    return reply.send(result);
  }
}
