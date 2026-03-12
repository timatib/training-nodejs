import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  slogan: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  age: z.number().int().min(10).max(120).optional(),
  weight: z.number().min(20).max(500).optional(),
  height: z.number().min(50).max(300).optional(),
  fitnessLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  goal: z.string().optional(),
  aiStyle: z.enum(['STRICT', 'NORMAL', 'FUN']).optional(),
  theme: z.enum(['LIGHT', 'DARK']).optional(),
  language: z.string().min(2).max(5).optional(),
  workoutPlace: z.enum(['GYM', 'HOME', 'OUTDOOR']).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
