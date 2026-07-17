"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/dates";

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
