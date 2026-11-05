import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(60),
  unit: z.enum(["u", "kg", "g", "l", "ml"]),
  minStock: z.number().min(0),
  cost: z.number().min(0),
  stock: z.number().optional(),
});
