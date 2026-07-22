import { cache } from "react";
import { createClient } from "./server";

export type CurrentUser = {
  id: string;
  fullName: string;
  role: string;
  isDirection: boolean;
};

// Mémoïsée par requête (React.cache) : layout.tsx et chaque page.tsx
// appellent tous cette fonction, mais un seul aller-retour Supabase
// (getUser + profil) est réellement exécuté par navigation.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    isDirection: profile.role === "direction",
  };
});
