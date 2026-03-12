import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';
import { updateProfileSchema } from './users.schema';
import { JwtPayload } from '../../shared/types';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export class UsersController {
  constructor(private usersService: UsersService) {}

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    try {
      const profile = await this.usersService.getProfile(user.userId);
      return reply.send(profile);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const updated = await this.usersService.updateProfile(user.userId, parsed.data);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }

  async uploadAvatar(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;

    try {
      const data = await (request as any).file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Invalid file type. Only JPEG, PNG, WebP allowed' });
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${user.userId}-${crypto.randomBytes(8).toString('hex')}${path.extname(data.filename)}`;
      const filepath = path.join(uploadDir, filename);

      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filepath);
        data.file.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const avatarUrl = `/uploads/avatars/${filename}`;
      const updated = await this.usersService.updateAvatar(user.userId, avatarUrl);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to upload avatar' });
    }
  }
}
