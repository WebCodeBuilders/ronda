import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const userSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.enum(ROLES),
  color: z.string().default("accent"),
  pin: z.string().regex(/^\d{4}$/, "El PIN tiene 4 números").optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  password: z.string().min(8, "La contraseña tiene que tener 8 caracteres o más").optional().or(z.literal("")),
  active: z.boolean().default(true),
});
