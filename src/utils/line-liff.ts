const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
const DEFAULT_LIFF_ID = '2009589991-AhuyJnwX';
const DEFAULT_CHANNEL_ID = '2009589991';
const LINE_LOGIN_PENDING_KEY = 'lineLoginPending';
const LIFF_INIT_TIMEOUT_MS = 8000;

type LiffLoginParams = {
  redirectUri?: string;
};

type LiffInitConfig = {
  liffId: string;
  withLoginOnExternalBrowser?: boolean;
};

type PendingState = {
  redirectUri: string;
  createdAt: number;
};

type LiffWindow = Window & {
  liff?: {
    init: (config: LiffInitConfig) => Promise<void>;
    isLoggedIn: () => boolean;
    login: (params?: LiffLoginParams) => void;
    logout: () => void;
    getIDToken: () => string | null;
  };
};

let liffInitPromise: Promise<void> | null = null;
let initializedLiffConfigKey: string | null = null;

function getWindow(): LiffWindow {
  return window as LiffWindow;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function getConfiguredLineLiffId(): string {
  return import.meta.env.VITE_LINE_LIFF_ID || DEFAULT_LIFF_ID;
}

export function getConfiguredLineChannelId(): string {
  return (
    import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID ||
    import.meta.env.VITE_LINE_CHANNEL_ID ||
    getConfiguredLineLiffId().split('-')[0] ||
    DEFAULT_CHANNEL_ID
  );
}

export function getConfiguredLineLaunchUrl(liffId: string = getConfiguredLineLiffId()): string {
  return `https://liff.line.me/${liffId}`;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function openLineUrlExternally(url: string): boolean {
  try {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    return newWindow !== null;
  } catch {
    return false;
  }
}

function readPendingState(): PendingState | null {
  try {
    const raw = localStorage.getItem(LINE_LOGIN_PENDING_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PendingState;
  } catch {
    return null;
  }
}

export function setLineLoginPending(redirectUri: string): void {
  try {
    const pendingState: PendingState = {
      redirectUri,
      createdAt: Date.now(),
    };
    localStorage.setItem(LINE_LOGIN_PENDING_KEY, JSON.stringify(pendingState));
  } catch {
    // Ignore storage failures and rely on URL markers.
  }
}

export function clearLineLoginPending(): void {
  try {
    localStorage.removeItem(LINE_LOGIN_PENDING_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function resetLineLiffState(): void {
  clearLineLoginPending();
  liffInitPromise = null;
  initializedLiffConfigKey = null;
}

export function hasRecentLineLoginPending(maxAgeMs: number = 10 * 60 * 1000): boolean {
  const pendingState = readPendingState();
  if (!pendingState) {
    return false;
  }

  if (Date.now() - pendingState.createdAt > maxAgeMs) {
    clearLineLoginPending();
    return false;
  }

  return true;
}

export function isLineLoginCallbackUrl(url: URL = new URL(window.location.href)): boolean {
  return ['line_login', 'code', 'state', 'liff.state', 'liffClientId'].some((key) =>
    url.searchParams.has(key)
  );
}

export function buildLineLoginRedirectUri(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('line_login', '1');
  url.searchParams.set('line_ts', String(Date.now()));
  return url.toString();
}

export function cleanupLineLoginCallbackUrl(): void {
  const url = new URL(window.location.href);
  [
    'line_login',
    'line_ts',
    'code',
    'state',
    'friendship_status_changed',
    'liff.state',
    'liffClientId',
    'error',
    'error_description',
  ].forEach((key) => url.searchParams.delete(key));

  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function loadLiffSdk(): Promise<NonNullable<LiffWindow['liff']>> {
  const existingLiff = getWindow().liff;
  if (existingLiff) {
    return existingLiff;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load LINE SDK')), {
        once: true,
      });
    });
    if (!getWindow().liff) {
      throw new Error('LINE SDK is unavailable');
    }
    return getWindow().liff!;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load LINE SDK'));
    document.head.appendChild(script);
  });

  if (!getWindow().liff) {
    throw new Error('LINE SDK is unavailable');
  }

  return getWindow().liff!;
}

export async function initLiff(
  liffId: string = getConfiguredLineLiffId(),
  withLoginOnExternalBrowser: boolean = false
) {
  const liff = await withTimeout(loadLiffSdk(), LIFF_INIT_TIMEOUT_MS, 'LINE SDK load timed out');
  const configKey = `${liffId}:${withLoginOnExternalBrowser ? 'external' : 'internal'}`;

  if (!liffInitPromise || initializedLiffConfigKey !== configKey) {
    initializedLiffConfigKey = configKey;
    liffInitPromise = withTimeout(
      liff.init({ liffId, withLoginOnExternalBrowser }),
      LIFF_INIT_TIMEOUT_MS,
      'LINE login initialization timed out'
    );
  }

  await liffInitPromise;
  return liff;
}

export async function getLineIdToken(
  liffId: string = getConfiguredLineLiffId(),
  retries: number = 5
): Promise<string> {
  const liff = await initLiff(liffId, isStandalonePwa());

  if (!liff.isLoggedIn()) {
    throw new Error('LINE login session was not found');
  }

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const idToken = liff.getIDToken();
    if (idToken) {
      const payload = parseJwtPayload(idToken);
      if (payload?.exp && payload.exp * 1000 <= Date.now()) {
        throw new Error('LINE identity token is invalid or expired');
      }
      return idToken;
    }
    await wait(300 * (attempt + 1));
  }

  throw new Error('LINE identity token is invalid or expired');
}

export async function beginLineLogin(
  liffId: string = getConfiguredLineLiffId()
): Promise<{ redirected: boolean; idToken?: string }> {
  const redirectUri = buildLineLoginRedirectUri();
  setLineLoginPending(redirectUri);

  try {
    const liff = await initLiff(liffId, isStandalonePwa());

    if (liff.isLoggedIn()) {
      const idToken = await getLineIdToken(liffId);
      return { redirected: false, idToken };
    }

    liff.login({ redirectUri });
    return { redirected: true };
  } catch {
    redirectToLineLiff(liffId, redirectUri);
    return { redirected: true };
  }
}

export async function tryLineLogout(): Promise<void> {
  resetLineLiffState();

  try {
    const liff = getWindow().liff;
    if (liff && liff.isLoggedIn()) {
      liff.logout();
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export function redirectToLineLiff(
  liffId: string = getConfiguredLineLiffId(),
  redirectUri: string = buildLineLoginRedirectUri()
): void {
  const launchUrl = new URL(getConfiguredLineLaunchUrl(liffId));
  setLineLoginPending(redirectUri);

  const launchUrlString = launchUrl.toString();
  if (isStandalonePwa() && openLineUrlExternally(launchUrlString)) {
    return;
  }

  window.location.assign(launchUrlString);
}
