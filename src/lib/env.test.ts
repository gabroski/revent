import { describe, it, expect, afterEach, vi } from "vitest";
import { getEnv } from "./env";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.unstubAllEnvs();
});

function setBase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

describe("getEnv", () => {
  it("returns parsed supabase config", () => {
    setBase();
    const env = getEnv();
    expect(env.supabaseUrl).toBe("http://localhost:54321");
    expect(env.supabaseAnonKey).toBe("anon-key");
  });

  it("throws a named error when a variable is missing", () => {
    setBase();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("falls back to localhost for the site URL in development", () => {
    setBase();
    vi.stubEnv("NODE_ENV", "development");
    expect(getEnv().siteUrl).toBe("http://localhost:3000");
  });

  it("uses the configured site URL when present", () => {
    setBase();
    process.env.NEXT_PUBLIC_SITE_URL = "https://revent.ge";
    expect(getEnv().siteUrl).toBe("https://revent.ge");
  });

  it("strips a trailing slash so joined paths never double up", () => {
    setBase();
    process.env.NEXT_PUBLIC_SITE_URL = "https://revent.ge/";
    expect(getEnv().siteUrl).toBe("https://revent.ge");
  });

  it("refuses to start in production without an explicit site URL", () => {
    setBase();
    vi.stubEnv("NODE_ENV", "production");
    // Auth emails link to this origin; guessing it from headers is exploitable.
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects a site URL that is not a URL", () => {
    setBase();
    process.env.NEXT_PUBLIC_SITE_URL = "revent.ge";
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
