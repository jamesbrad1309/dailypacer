import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Every start: creates this owner if there's no account with the email (src/auth/auth.service.ts).
  OWNER_EMAIL: z.string().default("admin@dailypacer.local"),
  OWNER_PASSWORD: z.string().default("dailypaceradmin123"),
  OWNER_NAME: z.string().default("Admin"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
