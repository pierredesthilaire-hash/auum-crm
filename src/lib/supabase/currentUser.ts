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
  // Identité lue dans le jeton (vérifié par le proxy à chaque requête) : évite un aller-retour réseau vers Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    isDirection: profile.role === "direction",
  };
});
