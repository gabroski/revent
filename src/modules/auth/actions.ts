"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Locale } from "@/i18n/routing";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/session";
import {
  forgotSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetSchema,
} from "./schemas";

/**
 * Actions return a typed result rather than throwing across the boundary, so
 * forms can render field-level errors. Message values are translation keys, not
 * prose — the form looks them up in the active locale.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | { status: "success"; message: string };

function fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}

async function siteOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function registerAction(
  locale: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
    terms: formData.get("terms") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "checkTheForm",
      fields: fieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user trigger to populate the profile row.
      data: { display_name: parsed.data.displayName, locale },
      emailRedirectTo: `${await siteOrigin()}/${locale}/auth/callback`,
    },
  });

  if (error) {
    // Supabase returns the same shape whether or not the address is taken, so
    // this does not leak which emails are registered.
    return { status: "error", message: "registerFailed" };
  }

  return { status: "success", message: "checkYourEmail" };
}

export async function loginAction(
  locale: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "checkTheForm",
      fields: fieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: naming which half was wrong tells an attacker which
    // addresses exist.
    return { status: "error", message: "invalidCredentials" };
  }

  redirect(`/${locale}/profile`);
}

export async function logoutAction(locale: Locale): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}

export async function forgotAction(
  locale: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      message: "checkTheForm",
      fields: fieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/${locale}/auth/reset`,
  });

  // Always the same answer, sent or not: anything else is an account oracle.
  return { status: "success", message: "resetLinkSent" };
}

export async function resetAction(
  locale: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "checkTheForm",
      fields: fieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { status: "error", message: "resetFailed" };

  redirect(`/${locale}/profile`);
}

export async function updateProfileAction(
  locale: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "checkTheForm",
      fields: fieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  // No role column here: RLS and a trigger both refuse it, but the safest
  // request is the one that never asks.
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.locale,
    })
    .eq("id", user.id);

  if (error) return { status: "error", message: "saveFailed" };

  revalidatePath(`/${locale}/profile`);
  return { status: "success", message: "profileSaved" };
}
