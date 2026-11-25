import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { login } from "../auth/actions";

export const metadata: Metadata = { title: "Sign in | StackPulse" };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const destination = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <AuthForm mode="login" action={login} next={destination} />;
}
