import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { register } from "../auth/actions";

export const metadata: Metadata = { title: "Create account | StackPulse" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={register} />;
}
