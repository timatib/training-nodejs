import { FastifyRequest, FastifyReply } from 'fastify';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { role: string };
    if (payload.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
