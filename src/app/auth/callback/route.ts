import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Le refresh token Microsoft n'est renvoyé qu'à cet instant précis
      // par Supabase — on le stocke nous-mêmes pour pouvoir rafraîchir le
      // token Graph plus tard (Supabase ne le conserve pas).
      const providerRefreshToken = data.session.provider_refresh_token;
      if (providerRefreshToken) {
        await supabase.from("ms_tokens").upsert({
          user_id: data.session.user.id,
          refresh_token: providerRefreshToken,
          updated_at: new Date().toISOString(),
        });
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
