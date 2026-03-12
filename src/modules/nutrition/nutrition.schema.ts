import { z } from 'zod';

export const logMealSchema = z.object({
  meal: z.string().min(1, 'Meal description is required'),
  date: z.string().optional(),
});

export type LogMealDto = z.infer<typeof logMealSchema>;
