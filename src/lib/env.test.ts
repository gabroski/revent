import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "./env";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("getEnv", () => {
  it("returns parsed supabase config", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getEnv()).toEqual({
      supabaseUrl: "http://localhost:54321",
      supabaseAnonKey: "anon-key",
    });
  });

  it("throws a named error when a variable is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
