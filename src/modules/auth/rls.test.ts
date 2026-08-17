import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * The tests that keep one user out of another user's account.
 *
 * These exercise the live policies rather than mocking them, because a mocked
 * RLS test proves nothing: the thing being tested is the database's behaviour.
 */
const hasSupabase = process.env.REVENT_DB_AVAILABLE === "true";
const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const canRun = hasSupabase && hasServiceKey;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PASSWORD = "correct horse battery staple";

describe.runIf(canRun)("profile access control", () => {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
  });

  const created: string[] = [];
  let aliceEmail = "";
  let bobId = "";

  beforeAll(async () => {
    const stamp = Date.now();
    aliceEmail = `rls-alice-${stamp}@revent.test`;

    for (const [email, name] of [
      [aliceEmail, "Alice"],
      [`rls-bob-${stamp}@revent.test`, "Bob"],
    ]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: name, locale: "en" },
      });
      if (error) throw error;
      created.push(data.user!.id);
    }
    bobId = created[1];
  });

  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  async function signInAsAlice() {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({
      email: aliceEmail,
      password: PASSWORD,
    });
    if (error) throw error;
    return client;
  }

  it("creates a profile row automatically for every new user", async () => {
    const { data } = await admin
      .from("profiles")
      .select("display_name, role, locale")
      .eq("id", created[0])
      .single();

    expect(data?.display_name).toBe("Alice");
    expect(data?.role).toBe("user");
    expect(data?.locale).toBe("en");
  });

  it("shows a signed-in user their own profile and no one else's", async () => {
    const alice = await signInAsAlice();
    const { data } = await alice.from("profiles").select("id");

    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(created[0]);
  });

  it("refuses to let a user edit another user's profile", async () => {
    const alice = await signInAsAlice();
    const { data } = await alice
      .from("profiles")
      .update({ display_name: "Owned" })
      .eq("id", bobId)
      .select();

    // RLS filters the row out, so the update matches nothing.
    expect(data ?? []).toHaveLength(0);

    const { data: bob } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", bobId)
      .single();
    expect(bob?.display_name).toBe("Bob");
  });

  it("refuses a self-promotion to admin", async () => {
    const alice = await signInAsAlice();
    const { error } = await alice
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", created[0]);

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/role cannot be changed/i);
  });

  it("lets a user rename themselves", async () => {
    const alice = await signInAsAlice();
    const { error } = await alice
      .from("profiles")
      .update({ display_name: "Alice Renamed" })
      .eq("id", created[0]);

    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", created[0])
      .single();
    expect(data?.display_name).toBe("Alice Renamed");
  });

  it("hides all profiles from anonymous visitors", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
