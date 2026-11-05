import { z } from "zod";

export const groupSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(0).max(20),
    options: z.array(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(40), priceDelta: z.number(), available: z.boolean().default(true) })).min(1).max(40),
  })
  .refine((g) => g.maxSelect === 0 || g.maxSelect >= g.minSelect, { message: "El máximo no puede ser menor que el mínimo", path: ["maxSelect"] });
