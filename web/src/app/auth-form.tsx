"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./auth/actions";

type AuthFormProps = {
  mode: "login" | "register";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
};

const initialState: AuthState = {};

export function AuthForm({ mode, action, next = "/" }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isLogin = mode === "login";

  return <main className="grid min-h-screen place-items-center bg-[#07111b] px-5 py-10 text-slate-100">
    <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0b1a26] p-6 shadow-2xl shadow-black/20 sm:p-8">
      <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><span className="grid size-8 place-items-center rounded-lg bg-cyan-300 text-sm font-black text-[#05202a]">S</span>Stack<span className="-ml-2 text-cyan-300">Pulse</span></Link>
      <div className="mt-8"><p className="text-sm font-medium text-cyan-300">{isLogin ? "Welcome back" : "Start monitoring"}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{isLogin ? "Sign in to StackPulse" : "Create your account"}</h1><p className="mt-2 text-sm leading-6 text-slate-400">{isLogin ? "Use your email and password to access your monitoring workspace." : "Set up your identity now; monitor setup comes next."}</p></div>
      <form action={formAction} className="mt-7 space-y-5" noValidate>
        {isLogin && <input name="next" type="hidden" value={next} />}
        <label className="block text-sm font-medium text-slate-300">Email<input className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label className="block text-sm font-medium text-slate-300">Password<input className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? undefined : 8} placeholder={isLogin ? "Enter your password" : "At least 8 characters"} required /></label>
        {state.error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200" role="alert">{state.error}</p>}
        {state.success && <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-100" role="status">{state.success}</p>}
        <button className="w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#05202a] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">{isLogin ? "New to StackPulse?" : "Already have an account?"} <Link className="font-medium text-cyan-300 hover:text-cyan-200" href={isLogin ? "/register" : "/login"}>{isLogin ? "Create an account" : "Sign in"}</Link></p>
    </section>
  </main>;
}
