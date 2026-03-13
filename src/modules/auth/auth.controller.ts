import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, forgotPasswordSchema, changePasswordSchema } from './auth.schema';
import { JwtPayload } from '../../shared/types';

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const user = await this.authService.register(parsed.data);

      const accessToken = await reply.jwtSign(
        { userId: user.id, email: user.email, role: user.role },
        { sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } }
      );

      const refreshToken = await reply.jwtSign(
        { userId: user.id, email: user.email, role: user.role },
        { sign: { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', key: process.env.JWT_REFRESH_SECRET } }
      );

      await this.authService.saveRefreshToken(user.id, refreshToken);

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.status(201).send({ accessToken, user });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const user = await this.authService.login(parsed.data);

      const accessToken = await reply.jwtSign(
        { userId: user.id, email: user.email, role: user.role },
        { sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } }
      );

      const refreshToken = await reply.jwtSign(
        { userId: user.id, email: user.email, role: user.role },
        { sign: { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', key: process.env.JWT_REFRESH_SECRET } }
      );

      await this.authService.saveRefreshToken(user.id, refreshToken);

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.send({ accessToken, user });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies?.refreshToken;
    if (!token) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    try {
      const stored = await this.authService.findRefreshToken(token);
      if (!stored || stored.expiresAt < new Date()) {
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      const accessToken = await reply.jwtSign(
        { userId: stored.user.id, email: stored.user.email, role: stored.user.role },
        { sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } }
      );

      return reply.send({ accessToken });
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies?.refreshToken;
    if (token) {
      await this.authService.deleteRefreshToken(token);
    }

    reply.clearCookie('refreshToken', { path: '/' });
    return reply.send({ message: 'Logged out successfully' });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const result = await this.authService.forgotPassword(parsed.data);
    return reply.send(result);
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const result = await this.authService.changePassword(user.userId, parsed.data);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }
}
