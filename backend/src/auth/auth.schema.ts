import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  tenantName: z.string().min(2).max(80),
  tenantSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  tenantSlug: z.string().min(2).max(60),
});

export const registerFromInviteSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  token: z.string().min(16),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(16),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterFromInviteInput = z.infer<typeof registerFromInviteSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
