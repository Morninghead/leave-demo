const DEFAULT_LINE_LIFF_ID = '2009589991-AhuyJnwX';
const DEFAULT_LINE_CHANNEL_ID = '2009589991';

export interface VerifiedLineProfile {
  sub: string;
  aud: string;
  name?: string;
  picture?: string;
  email?: string;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function getConfiguredLineLiffId(): string {
  return process.env.VITE_LINE_LIFF_ID || process.env.LINE_LIFF_ID || DEFAULT_LINE_LIFF_ID;
}

export function getConfiguredLineChannelIds(idToken?: string): string[] {
  const envIds = [
    process.env.LINE_LOGIN_CHANNEL_ID,
    process.env.LINE_CHANNEL_ID,
    process.env.VITE_LINE_LOGIN_CHANNEL_ID,
    process.env.VITE_LINE_CHANNEL_ID,
    getConfiguredLineLiffId().split('-')[0],
    DEFAULT_LINE_CHANNEL_ID,
  ].filter(Boolean) as string[];

  const tokenAud = decodeJwtPayload(idToken || '')?.aud;
  const ordered = tokenAud ? [tokenAud, ...envIds] : envIds;
  return [...new Set(ordered)];
}

async function verifyWithClientId(idToken: string, clientId: string): Promise<VerifiedLineProfile | null> {
  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: clientId,
    }).toString(),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as VerifiedLineProfile;
  if (!data?.sub || !data?.aud) {
    return null;
  }

  return data;
}

export async function verifyLineIdToken(idToken: string): Promise<VerifiedLineProfile> {
  const clientIds = getConfiguredLineChannelIds(idToken);

  for (const clientId of clientIds) {
    const profile = await verifyWithClientId(idToken, clientId);
    if (profile) {
      return profile;
    }
  }

  throw new Error('LINE identity token is invalid or expired');
}
