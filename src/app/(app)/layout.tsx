import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { signOut } from "../login/actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  const isDirection = profile?.role === "direction";

  return (
    <div className="flex min-h-screen">
      <Sidebar isDirection={isDirection} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-3 border-b px-6 py-3"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}
        >
          <div className="font-display text-[17px] font-semibold">auum CRM</div>
          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--muted)]">
            <span>
              {profile?.full_name} · {isDirection ? "direction" : "AE"}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-[var(--teal)] hover:text-[var(--teal)]"
                style={{ borderColor: "var(--line)" }}
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6" style={{ background: "var(--bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
