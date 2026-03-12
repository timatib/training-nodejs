import { z } from 'zod';

export const addProgressSchema = z.object({
  note: z.string().min(10, 'Progress note must be at least 10 characters'),
});

export type AddProgressDto = z.infer<typeof addProgressSchema>;
