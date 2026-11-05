import { z } from "zod";

export const stationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().default("accent"),
  kdsEnabled: z.boolean().default(true),
  printerEnabled: z.boolean().default(false),
  printerHost: z.string().trim().max(80).nullable().optional(),
  printerPort: z.number().int().min(1).max(65535).default(9100),
  printerWidth: z.number().int().min(24).max(64).default(42),
  printerCopies: z.number().int().min(1).max(5).default(1),
});
