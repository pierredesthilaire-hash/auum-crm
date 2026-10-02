import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/outlook";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("outlook_state="))
    ?.split("=")[1];

  const fail = NextResponse.redirect(`${origin}/dashboard?outlook=error`);
  if (!code || !state || state !== cookieState) return fail;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const tokens = await exchangeCode(code);
  if (!tokens.refresh_token) return fail;

  const { error } = await supabase
    .from("ms_tokens")
    .upsert({ user_id: user.id, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() });
  if (error) return fail;

  const res = NextResponse.redirect(`${origin}/dashboard?outlook=ok`);
  res.cookies.delete("outlook_state");
  return res;
}
