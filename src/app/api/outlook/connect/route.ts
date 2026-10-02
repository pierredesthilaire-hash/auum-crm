import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizeUrl } from "@/lib/outlook";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const state = crypto.randomUUID();
  const url = authorizeUrl(state);
  if (!url) return NextResponse.redirect(`${origin}/dashboard?outlook=config`);

  const res = NextResponse.redirect(url);
  res.cookies.set("outlook_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
