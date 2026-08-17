import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  profileSchema,
  passwordStrength,
} from "./schemas";

describe("registerSchema", () => {
  const valid = {
    displayName: "Gio",
    email: "gio@example.com",
    password: "correct horse battery",
    locale: "ka",
    terms: "on",
  };

  it("accepts a complete registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "gio@" });
    expect(result.success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "short1" });
    expect(result.success).toBe(false);
  });

  it("requires the terms checkbox", () => {
    const result = registerSchema.safeParse({ ...valid, terms: undefined });
    expect(result.success).toBe(false);
  });

  it("trims the display name", () => {
    const result = registerSchema.parse({ ...valid, displayName: "  Gio  " });
    expect(result.displayName).toBe("Gio");
  });

  it("lowercases the email so duplicates cannot differ by case", () => {
    const result = registerSchema.parse({ ...valid, email: "GIO@Example.COM" });
    expect(result.email).toBe("gio@example.com");
  });

  it("rejects an unknown locale rather than trusting the form", () => {
    expect(registerSchema.safeParse({ ...valid, locale: "ru" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email and any non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("forgotSchema", () => {
  it("accepts an email", () => {
    expect(forgotSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
});

describe("resetSchema", () => {
  it("accepts matching passwords", () => {
    const input = { password: "correct horse", confirm: "correct horse" };
    expect(resetSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a mismatch and blames the confirm field", () => {
    const result = resetSchema.safeParse({
      password: "correct horse",
      confirm: "correct hose",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirm"]);
    }
  });
});

describe("profileSchema", () => {
  it("accepts a name and locale", () => {
    expect(profileSchema.safeParse({ displayName: "Gio", locale: "en" }).success).toBe(
      true,
    );
  });

  it("rejects an empty name", () => {
    expect(profileSchema.safeParse({ displayName: "  ", locale: "en" }).success).toBe(
      false,
    );
  });
});

describe("passwordStrength", () => {
  it("scores an empty password as zero", () => {
    expect(passwordStrength("")).toBe(0);
  });

  it("rates a short simple password weak", () => {
    expect(passwordStrength("pass123")).toBeLessThanOrEqual(1);
  });

  it("rewards length over symbol soup", () => {
    expect(passwordStrength("correct horse battery staple")).toBeGreaterThanOrEqual(3);
  });

  it("caps at 4", () => {
    expect(passwordStrength("Correct-Horse-Battery-Staple-99!")).toBeLessThanOrEqual(4);
  });
});
