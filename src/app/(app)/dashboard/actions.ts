"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/dates";
import { refreshAccess } from "@/lib/outlook";

export async function markTaskDone(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", done_on: todayISO() })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function snoozeTask(taskId: string, days: number): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: task, error: fetchErr } = await supabase.from("tasks").select("due").eq("id", taskId).single();
  if (fetchErr || !task) return { ok: false, error: "Tâche introuvable" };

  const newDue = addDaysISO(task.due ?? todayISO(), days);

  const { error } = await supabase.from("tasks").update({ due: newDue }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export type NewTaskInput = {
  title: string;
  type: string;
  due: string | null;
  note: string;
  ownerId: string;
};

export async function createTask(input: NewTaskInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    title: input.title,
    type: input.type,
    due: input.due,
    note: input.note || null,
    owner_id: input.ownerId,
    created_by: user?.id ?? null,
    status: "open",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

type GraphEvent = {
  id: string;
  subject: string | null;
  isAllDay?: boolean;
  isCancelled?: boolean;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: { displayName?: string };
  attendees?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  organizer?: { emailAddress?: { address?: string; name?: string } };
};

const GENERIC_DOMAINS = new Set(["gmail.com", "outlook.com", "hotmail.com", "hotmail.fr", "yahoo.fr", "yahoo.com", "icloud.com", "live.fr", "orange.fr", "free.fr", "wanadoo.fr"]);

/** Synchronise les RDV Outlook de l'utilisateur connecté (aujourd'hui + 7 jours). */
export async function syncOutlook(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté" };

  const { data: tok } = await supabase.from("ms_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
  if (!tok) return { ok: false, error: "Outlook n'est pas connecté" };

  const t = await refreshAccess(tok.refresh_token);
  if (!t.access_token) return { ok: false, error: "Connexion Outlook expirée : reconnectez-vous à Outlook" };
  if (t.refresh_token) {
    await supabase.from("ms_tokens").update({ refresh_token: t.refresh_token, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  }

  const parisToday = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const end = addDaysISO(parisToday, 8);
  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${parisToday}T00:00:00&endDateTime=${end}T00:00:00` +
    `&$select=id,subject,isAllDay,isCancelled,start,end,location,attendees,organizer&$orderby=start/dateTime&$top=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${t.access_token}`, Prefer: 'outlook.timezone="Romance Standard Time"' },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Microsoft a refusé la lecture du calendrier (${res.status})` };
  const events = ((await res.json()) as { value: GraphEvent[] }).value.filter((e) => !e.isCancelled && !e.isAllDay);

  // Rapprochement par email puis par domaine avec les contacts visibles de l'AE.
  const [{ data: contacts }, { data: opps }] = await Promise.all([
    supabase.from("contacts").select("email, entity_id").not("email", "is", null),
    supabase.from("opportunities").select("id, entity_id").eq("state", "open").eq("ae_id", user.id),
  ]);
  const byEmail = new Map<string, string>();
  const domainEntities = new Map<string, Set<string>>();
  for (const c of contacts ?? []) {
    const em = (c.email as string).trim().toLowerCase();
    if (!c.entity_id) continue;
    byEmail.set(em, c.entity_id);
    const dom = em.split("@")[1];
    if (dom && !GENERIC_DOMAINS.has(dom)) {
      const s = domainEntities.get(dom) ?? new Set<string>();
      s.add(c.entity_id);
      domainEntities.set(dom, s);
    }
  }
  const oppByEntity = new Map<string, string>();
  for (const o of opps ?? []) if (!oppByEntity.has(o.entity_id)) oppByEntity.set(o.entity_id, o.id);

  const me = (user.email ?? "").toLowerCase();
  const rows = events.map((e) => {
    const guests = (e.attendees ?? [])
      .map((a) => a.emailAddress)
      .filter((a): a is { address?: string; name?: string } => !!a?.address)
      .filter((a) => a.address!.toLowerCase() !== me);
    let entityId: string | null = null;
    for (const g of guests) {
      const em = g.address!.toLowerCase();
      entityId = byEmail.get(em) ?? null;
      if (!entityId) {
        const s = domainEntities.get(em.split("@")[1]);
        if (s && s.size === 1) entityId = [...s][0];
      }
      if (entityId) break;
    }
    return {
      ae_id: user.id,
      graph_id: e.id,
      date: e.start.dateTime.slice(0, 10),
      start_time: e.start.dateTime.slice(11, 16),
      end_time: e.end.dateTime.slice(11, 16),
      title: e.subject ?? "(sans titre)",
      with_who: guests.map((g) => g.name || g.address).slice(0, 3).join(", ") || null,
      place: e.location?.displayName || null,
      entity_id: entityId,
      opp_id: entityId ? oppByEntity.get(entityId) ?? null : null,
    };
  });

  // On remplace la fenêtre synchronisée pour retirer les RDV supprimés ou déplacés.
  await supabase.from("meetings").delete().eq("ae_id", user.id).gte("date", parisToday).lt("date", end);
  if (rows.length) {
    const { error } = await supabase.from("meetings").upsert(rows, { onConflict: "graph_id" });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/dashboard");
  return { ok: true, count: rows.length };
}
