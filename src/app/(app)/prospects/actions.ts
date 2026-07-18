"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseCSV(text: string): Record<string, string>[] {
  const firstLine = text.split("\n")[0] ?? "";
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  const sep = semi > comma ? ";" : ",";
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const split = (l: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const v = split(l);
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = v[i] ?? ""));
    return o;
  });
}

function findColumn(headers: string[], keys: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  const idx = lower.findIndex((h) => keys.some((k) => h.includes(k)));
  return idx >= 0 ? headers[idx] : null;
}

export async function importProspectsCsv(
  formData: FormData,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Aucun fichier" };

  const text = await file.text();
  const rows = parseCSV(text);
  if (!rows.length) return { ok: false, error: "Aucune ligne exploitable" };

  const headers = Object.keys(rows[0]);
  const M = {
    company: findColumn(headers, ["societe", "société", "entreprise", "company", "raison", "denomination", "dénomination", "account", "compte"]),
    contact: findColumn(headers, ["contact", "nom complet", "full name", "prenom", "prénom", "nom"]),
    role: findColumn(headers, ["fonction", "titre", "poste", "job", "role", "rôle"]),
    email: findColumn(headers, ["mail"]),
    phone: findColumn(headers, ["tel", "tél", "phone", "portable", "mobile"]),
    city: findColumn(headers, ["ville", "city", "commune"]),
    sector: findColumn(headers, ["secteur", "naf", "ape", "activite", "activité", "industry"]),
    ae: findColumn(headers, ["ae", "commercial", "owner", "proprietaire", "propriétaire", "attribu"]),
    linkedin: findColumn(headers, ["linkedin", "profil", "profile url", "lien li"]),
  };
  if (!M.company) return { ok: false, error: "Colonne société introuvable — vérifiez les en-têtes du fichier" };

  const supabase = await createClient();
  const { data: aes } = await supabase.from("profiles").select("id, full_name").eq("role", "ae");

  const toInsert = [];
  for (const r of rows) {
    const company = String(r[M.company] ?? "").trim();
    if (!company) continue;
    const aeRaw = M.ae ? String(r[M.ae] ?? "").trim() : "";
    const ae = aeRaw ? aes?.find((a) => a.full_name.toLowerCase().includes(aeRaw.toLowerCase())) : null;
    toInsert.push({
      company,
      contact: (M.contact ? String(r[M.contact] ?? "").trim() : "") || null,
      role: (M.role ? String(r[M.role] ?? "").trim() : "") || null,
      email: (M.email ? String(r[M.email] ?? "").trim() : "") || null,
      phone: (M.phone ? String(r[M.phone] ?? "").trim() : "") || null,
      city: (M.city ? String(r[M.city] ?? "").trim() : "") || null,
      sector: (M.sector ? String(r[M.sector] ?? "").trim() : "") || null,
      linkedin: (M.linkedin ? String(r[M.linkedin] ?? "").trim() : "") || null,
      ae_id: ae?.id ?? null,
      status: "a_contacter",
      source: `Import ${file.name}`,
    });
  }
  if (!toInsert.length) return { ok: false, error: "Aucune ligne exploitable (colonne société vide partout)" };

  const { error } = await supabase.from("prospects").insert(toInsert);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/prospects");
  return { ok: true, count: toInsert.length };
}

export async function logTouch(
  prospectId: string,
  type: "email" | "tel" | "linkedin",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("touches").insert({ prospect_id: prospectId, type });
  if (error) return { ok: false, error: error.message };

  const { data: p } = await supabase.from("prospects").select("status").eq("id", prospectId).single();
  if (p?.status === "a_contacter") {
    await supabase.from("prospects").update({ status: "contacte" }).eq("id", prospectId);
  }

  revalidatePath("/prospects");
  return { ok: true };
}

export async function setProspectStatus(prospectId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ status }).eq("id", prospectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/prospects");
  return { ok: true };
}

export async function setProspectOwner(
  prospectId: string,
  aeId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ ae_id: aeId }).eq("id", prospectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/prospects");
  return { ok: true };
}

export async function convertProspectToOpp(
  prospectId: string,
): Promise<{ ok: boolean; error?: string; oppId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: p, error: fetchErr } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
  if (fetchErr || !p) return { ok: false, error: "Prospect introuvable" };
  if (p.opp_id) return { ok: false, error: "Déjà converti" };

  let entityId: string;
  const { data: existing } = await supabase.from("entities").select("id").eq("name", p.company).maybeSingle();
  if (existing) {
    entityId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("entities")
      .insert({ name: p.company, sector: p.sector, headcount: p.headcount, owner_id: p.ae_id })
      .select("id")
      .single();
    if (createErr || !created) return { ok: false, error: createErr?.message ?? "Échec de création du compte" };
    entityId = created.id;
  }

  if (p.contact) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("entity_id", entityId)
      .eq("full_name", p.contact)
      .maybeSingle();
    if (!existingContact) {
      await supabase.from("contacts").insert({
        entity_id: entityId,
        full_name: p.contact,
        role: p.role,
        email: p.email,
        phone: p.phone,
        linkedin: p.linkedin,
      });
    }
  }

  const notes = p.contact
    ? `Contact : ${p.contact}${p.role ? ` (${p.role})` : ""}${p.email ? ` · ${p.email}` : ""}${p.phone ? ` · ${p.phone}` : ""}`
    : "";

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      name: `${p.company} — opportunité issue de prospection`,
      entity_id: entityId,
      ae_id: p.ae_id ?? user!.id,
      stage: "qualification",
      stage_orig: "Créée depuis la prospection",
      source: "Outbound/Prospection",
      machines: 1,
      amount: 7400,
      prob: 20,
      notes,
    })
    .select("id")
    .single();
  if (oppErr || !opp) return { ok: false, error: oppErr?.message ?? "Échec de création de l'opportunité" };

  await supabase.from("audit_log").insert({
    user_id: user!.id,
    opp_id: opp.id,
    type: "opp_created",
    detail: `Créée depuis la prospection · ${p.company}`,
    delta_machines: 1,
    delta_amount: 7400,
  });

  await supabase.from("prospects").update({ status: "converti", opp_id: opp.id }).eq("id", prospectId);

  revalidatePath("/prospects");
  revalidatePath("/pipe");
  return { ok: true, oppId: opp.id };
}
