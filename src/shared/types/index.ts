import { FastifyRequest } from 'fastify';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JwtPayload;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}
