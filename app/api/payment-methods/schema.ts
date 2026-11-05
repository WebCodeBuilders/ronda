import { z } from "zod";

export const methodSchema = z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(["CASH", "CARD", "TRANSFER", "QR", "ACCOUNT", "OTHER"]), adjustPct: z.number().min(-50).max(100).default(0), active: z.boolean().default(true) });
