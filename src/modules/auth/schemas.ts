import { z } from "zod";
import { locales } from "@/i18n/routing";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "invalidEmail" }));

// 8 characters, no composition rules. Forcing a symbol and a capital produces
// "Password1!" — worse than a long ordinary phrase, and harder to remember.
const password = z.string().min(8, { message: "passwordTooShort" });

const locale = z.enum(locales);

const displayName = z
  .string()
  .trim()
  .min(1, { message: "nameRequired" })
  .max(60, { message: "nameTooLong" });

export const registerSchema = z.object({
  displayName,
  email,
  password,
  locale,
  // Checkboxes submit "on" when ticked and are absent otherwise.
  terms: z.literal("on", { message: "termsRequired" }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "passwordRequired" }),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((data) => data.password === data.confirm, {
    message: "passwordsDoNotMatch",
    path: ["confirm"],
  });

export const profileSchema = z.object({ displayName, locale });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Rough password strength, 0–4, for the signup meter.
 *
 * Weighted toward length rather than character classes, because length is what
 * actually resists guessing. This is feedback, not a gate — the only hard rule
 * is the 8-character minimum in the schema.
 */
export function passwordStrength(value: string): number {
  if (!value) return 0;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[^a-zA-Z0-9]/.test(value) || (/[a-z]/.test(value) && /[0-9]/.test(value))) {
    score += 1;
  }

  return Math.min(score, 4);
}
