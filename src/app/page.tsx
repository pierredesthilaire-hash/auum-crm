import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="font-display text-2xl font-bold" style={{ color: "var(--pine)" }}>
        auum<span style={{ color: "var(--teal)" }}>.</span> CRM
      </div>
      <p className="text-sm text-[var(--muted)]">
        Connecté en tant que <b>{profile?.full_name}</b> ({profile?.role})
      </p>
      <p className="text-xs text-[var(--muted)]">
        Écrans (Pipe, Mes clients, Dashboard, Cockpit) à venir — étape 5.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:border-[var(--teal)] hover:text-[var(--teal)]"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
