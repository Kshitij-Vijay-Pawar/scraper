"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "../../../store/useStore";
import { KeyRound, Mail, Lock, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, initialize, isLoading, error } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationErr, setValidationErr] = useState("");

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (token) {
      router.push("/");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErr("");

    if (!email || !password) {
      setValidationErr("Please fill in all fields");
      return;
    }

    const success = await login(email, password);
    if (success) {
      router.push("/");
    }
  };

  return (
    <div>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">Welcome back</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to manage your API scraper keys
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {validationErr && (
          <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3 text-sm text-red-400">
            {validationErr}
          </div>
        )}

        <div className="space-y-4 rounded-md shadow-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3 py-2.5 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-sm transition-colors"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="password"
                required
                className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3 py-2.5 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-sm transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center rounded-xl bg-violet-600 hover:bg-violet-500 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                Sign In <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-zinc-400">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
