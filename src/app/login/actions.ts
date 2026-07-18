"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prevState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return "Identifiant ou mot de passe incorrect.";
  }

  redirect("/");
}

export async function signInWithAzure() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "openid profile email offline_access Calendars.Read",
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Échec de connexion Microsoft");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
