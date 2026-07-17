"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { keur, fdate } from "@/lib/format";
import { stageOf } from "@/lib/stages";
import { todayISO } from "@/lib/dates";

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

export async function changeStage(
  oppId: string,
  toStage: string,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: opp, error: fetchErr } = await supabase
    .from("opportunities")
    .select("stage")
    .eq("id", oppId)
    .single();
  if (fetchErr || !opp) return { ok: false, error: "Opportunité introuvable" };

  const from = stageOf(opp.stage);
  const to = stageOf(toStage);
  if (!from || !to || from.id === to.id) return { ok: false };

  const stages = ["qualification", "decouverte", "demo", "nego", "signature"];
  const dir = stages.indexOf(to.id) > stages.indexOf(from.id) ? "up" : "down";

  const { error: updateErr } = await supabase
    .from("opportunities")
    .update({ stage: toStage, updated_at: new Date().toISOString() })
    .eq("id", oppId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("audit_log").insert({
    user_id: userId,
    opp_id: oppId,
    type: "stage_change",
    detail: `${from.label} → ${to.label}${comment ? " · " + comment : ""}`,
    dir,
  });

  revalidatePath("/pipe");
  return { ok: true };
}

type OpportunityEdits = {
  prob: number;
  machines: number;
  amount: number;
  closeDate: string | null;
  installDate: string | null;
  notes: string;
};

export async function saveOpportunity(
  oppId: string,
  edits: OpportunityEdits,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: opp, error: fetchErr } = await supabase
    .from("opportunities")
    .select("prob, machines, amount, close_date, install_date, notes")
    .eq("id", oppId)
    .single();
  if (fetchErr || !opp) return { ok: false, error: "Opportunité introuvable" };

  const logs: { type: string; detail: string; delta_machines?: number; delta_amount?: number }[] = [];
  if (edits.machines !== opp.machines) {
    logs.push({
      type: "field_change",
      detail: `Machines : ${opp.machines} → ${edits.machines}`,
      delta_machines: edits.machines - opp.machines,
    });
  }
  if (edits.amount !== opp.amount) {
    logs.push({
      type: "field_change",
      detail: `Montant : ${keur(opp.amount)} → ${keur(edits.amount)}`,
      delta_amount: edits.amount - opp.amount,
    });
  }
  if (edits.prob !== opp.prob) {
    logs.push({ type: "field_change", detail: `Probabilité : ${opp.prob} % → ${edits.prob} %` });
  }
  if (edits.closeDate !== opp.close_date) {
    logs.push({ type: "field_change", detail: `Closing : ${fdate(opp.close_date)} → ${fdate(edits.closeDate)}` });
  }
  if (edits.installDate !== opp.install_date) {
    logs.push({
      type: "field_change",
      detail: `Installation : ${fdate(opp.install_date)} → ${fdate(edits.installDate)}`,
    });
  }
  if (edits.notes !== (opp.notes ?? "")) {
    logs.push({ type: "field_change", detail: "Notes mises à jour" });
  }

  const { error: updateErr } = await supabase
    .from("opportunities")
    .update({
      prob: edits.prob,
      machines: edits.machines,
      amount: edits.amount,
      close_date: edits.closeDate,
      install_date: edits.installDate,
      notes: edits.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", oppId);
  if (updateErr) return { ok: false, error: updateErr.message };

  if (logs.length) {
    await supabase
      .from("audit_log")
      .insert(logs.map((l) => ({ ...l, user_id: userId, opp_id: oppId })));
  }

  revalidatePath("/pipe");
  return { ok: true };
}

export async function markWon(
  oppId: string,
  comment: string,
  addToParc: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: opp, error: fetchErr } = await supabase
    .from("opportunities")
    .select("machines, amount, entity_id")
    .eq("id", oppId)
    .single();
  if (fetchErr || !opp) return { ok: false, error: "Opportunité introuvable" };

  const { error: updateErr } = await supabase
    .from("opportunities")
    .update({ state: "won", closed_on: todayISO() })
    .eq("id", oppId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("audit_log").insert({
    user_id: userId,
    opp_id: oppId,
    type: "opp_won",
    detail: `Gagnée${comment ? " · " + comment : ""}`,
    delta_machines: opp.machines,
    delta_amount: opp.amount,
  });

  if (addToParc) {
    const { data: ent } = await supabase
      .from("entities")
      .select("name, parc")
      .eq("id", opp.entity_id)
      .single();
    if (ent) {
      await supabase
        .from("entities")
        .update({ parc: (ent.parc ?? 0) + opp.machines })
        .eq("id", opp.entity_id);
      await supabase.from("audit_log").insert({
        user_id: userId,
        opp_id: oppId,
        type: "parc_update",
        detail: `+${opp.machines} machines au parc de ${ent.name}`,
        delta_machines: opp.machines,
      });
    }
  }

  revalidatePath("/pipe");
  return { ok: true };
}

export async function markLost(oppId: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: opp, error: fetchErr } = await supabase
    .from("opportunities")
    .select("machines, amount")
    .eq("id", oppId)
    .single();
  if (fetchErr || !opp) return { ok: false, error: "Opportunité introuvable" };

  const { error: updateErr } = await supabase
    .from("opportunities")
    .update({ state: "lost", closed_on: todayISO() })
    .eq("id", oppId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("audit_log").insert({
    user_id: userId,
    opp_id: oppId,
    type: "opp_lost",
    detail: `Perdue${comment ? " · " + comment : ""}`,
    delta_machines: opp.machines,
    delta_amount: opp.amount,
  });

  revalidatePath("/pipe");
  return { ok: true };
}

export type NewOpportunityInput = {
  clientName: string;
  name: string;
  aeId: string;
  stage: string;
  machines: number;
  amount: number;
  prob: number;
  closeDate: string | null;
  source: string;
};

export async function createOpportunity(
  input: NewOpportunityInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const userId = await currentUserId();

  let entityId: string;
  const { data: existing } = await supabase
    .from("entities")
    .select("id")
    .eq("name", input.clientName)
    .maybeSingle();

  if (existing) {
    entityId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("entities")
      .insert({ name: input.clientName, owner_id: input.aeId })
      .select("id")
      .single();
    if (createErr || !created) return { ok: false, error: createErr?.message ?? "Compte introuvable" };
    entityId = created.id;
  }

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      name: input.name || `${input.clientName} — nouvelle opportunité`,
      entity_id: entityId,
      ae_id: input.aeId,
      stage: input.stage,
      stage_orig: "Créée dans le CRM",
      machines: input.machines,
      amount: input.amount,
      prob: input.prob,
      close_date: input.closeDate,
      source: input.source,
    })
    .select("id")
    .single();
  if (oppErr || !opp) return { ok: false, error: oppErr?.message ?? "Échec de création" };

  await supabase.from("audit_log").insert({
    user_id: userId,
    opp_id: opp.id,
    type: "opp_created",
    detail: `Créée · ${input.machines} machine(s) · ${keur(input.amount)}`,
    delta_machines: input.machines,
    delta_amount: input.amount,
  });

  revalidatePath("/pipe");
  return { ok: true, id: opp.id };
}
