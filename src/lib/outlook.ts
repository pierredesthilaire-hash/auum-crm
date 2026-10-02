/**
 * Connexion Outlook (Microsoft Graph, lecture du calendrier uniquement).
 * Indépendant du mode de connexion au CRM : un AE connecté par email + mot de
 * passe associe son Outlook via un consentement Microsoft distinct. Le refresh
 * token reste côté serveur (table ms_tokens, lisible par soi-même uniquement).
 */
export const MS_SCOPES = "offline_access Calendars.Read";

export function msConfig() {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenant = process.env.MS_TENANT_ID || "common";
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId || !clientSecret || !site) return null;
  return { clientId, clientSecret, tenant, redirectUri: `${site}/api/outlook/callback` };
}

type TokenResponse = { access_token?: string; refresh_token?: string; error_description?: string };

async function tokenRequest(tenant: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  return (await res.json()) as TokenResponse;
}

export function authorizeUrl(state: string): string | null {
  const c = msConfig();
  if (!c) return null;
  const p = new URLSearchParams({
    client_id: c.clientId,
    response_type: "code",
    redirect_uri: c.redirectUri,
    response_mode: "query",
    scope: MS_SCOPES,
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize?${p}`;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const c = msConfig();
  if (!c) return { error_description: "configuration Microsoft manquante" };
  return tokenRequest(c.tenant, {
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: c.redirectUri,
    scope: MS_SCOPES,
  });
}

export async function refreshAccess(refreshToken: string): Promise<TokenResponse> {
  const c = msConfig();
  if (!c) return { error_description: "configuration Microsoft manquante" };
  return tokenRequest(c.tenant, {
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MS_SCOPES,
  });
}
