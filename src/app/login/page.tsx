"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0E3F30 0%, #0A2E23 100%)",
      }}
    >
      <div className="w-[380px] max-w-[92vw] rounded-2xl bg-white p-8 shadow-2xl">
        <div
          className="font-display text-[32px] font-bold leading-none tracking-tight"
          style={{ color: "var(--pine)" }}
        >
          auum<span style={{ color: "var(--teal)" }}>.</span>
        </div>
        <div className="mb-6 mt-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
          CRM Ventes — Connexion
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink)]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="prenom.nom@auum.fr"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-2 focus:outline-[var(--teal)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink)]">
            Mot de passe
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••"
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--teal)] focus:outline-2 focus:outline-[var(--teal)]"
            />
          </label>

          <div className="h-4 text-xs font-semibold text-[var(--red)]">
            {error}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--teal)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F8A6D] disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
