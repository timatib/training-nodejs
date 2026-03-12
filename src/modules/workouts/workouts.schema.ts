import { z } from 'zod';

const exerciseSchema = z.object({
  name: z.string(),
  sets: z.number().optional(),
  reps: z.number().optional(),
  duration: z.number().optional(),
  icon: z.string().optional(),
});

export const createWorkoutSchema = z.object({
  title: z.string().min(1),
  date: z.string().datetime(),
  place: z.enum(['GYM', 'HOME', 'OUTDOOR']),
  exercises: z.array(exerciseSchema),
});

export const updateWorkoutSchema = createWorkoutSchema.partial();

export type CreateWorkoutDto = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutDto = z.infer<typeof updateWorkoutSchema>;
