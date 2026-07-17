"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateEntity(
  entityId: string,
  patch: Partial<{
    headcount: number | null;
    group_id: string | null;
    owner_id: string | null;
    parc: number;
    parc_note: string | null;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("entities").update(patch).eq("id", entityId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}

export async function createGroup(name: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").insert({ name }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message };
  revalidatePath("/clients");
  return { ok: true, id: data.id };
}

export async function addContact(
  entityId: string,
  contact: { full_name: string; role: string; email: string; phone: string },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    entity_id: entityId,
    full_name: contact.full_name,
    role: contact.role || null,
    email: contact.email || null,
    phone: contact.phone || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}

export async function removeContact(contactId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}
