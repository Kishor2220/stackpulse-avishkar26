"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function credentials(formData: FormData, requireStrongPassword = false) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!emailPattern.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your password." };
  if (requireStrongPassword && password.length < 8) {
    return { error: "Use a password with at least 8 characters." };
  }

  return { email, password };
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const values = credentials(formData);
  if ("error" in values) return values;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(values);

  if (error) return { error: "We could not sign you in with those credentials." };

  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const values = credentials(formData, true);
  if ("error" in values) return values;

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...values,
    options: origin ? { emailRedirectTo: `${origin}/auth/confirm` } : undefined,
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/");

  return { success: "Check your email to confirm your account, then sign in." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
