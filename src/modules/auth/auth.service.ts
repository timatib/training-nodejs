import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { RegisterDto, LoginDto, ForgotPasswordDto, ChangePasswordDto } from './auth.schema';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw { statusCode: 409, message: 'Email already registered' };
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        subscription: {
          create: {
            type: 'TRIAL',
            tokensLimit: 10000,
          },
        },
        streaks: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { subscription: true },
    });

    if (!user) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      subscription: user.subscription,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a temporary password has been sent' };
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await argon2.hash(tempPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Send email
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: dto.email,
        subject: 'AI Тренер — Временный пароль',
        text: `Ваш временный пароль: ${tempPassword}\n\nПожалуйста, смените пароль после входа.`,
        html: `<p>Ваш временный пароль: <strong>${tempPassword}</strong></p><p>Пожалуйста, смените пароль после входа.</p>`,
      });
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
    }

    return { message: 'If the email exists, a temporary password has been sent' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!validPassword) {
      throw { statusCode: 401, message: 'Current password is incorrect' };
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async saveRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findRefreshToken(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async deleteRefreshToken(token: string) {
    try {
      await this.prisma.refreshToken.delete({ where: { token } });
    } catch {
      // ignore if not found
    }
  }

  async deleteAllUserRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
