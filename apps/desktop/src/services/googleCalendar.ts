import { saveGoogleSessionToken } from "./jarvisApi";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

const GOOGLE_PENDING_AUTH_KEY = "jarvis.google.pending_auth";
const GOOGLE_CALENDAR_SESSION_KEY = "jarvis.google.calendar_token";
const GOOGLE_GMAIL_SESSION_KEY = "jarvis.google.gmail_token";

type GooglePendingAuth = {
  service: "calendar" | "gmail";
  scope: string;
  state: string;
};

export type GoogleRedirectAuthResult = {
  accessToken: string;
  service: "calendar" | "gmail";
};

export type GoogleCalendarEventRecord = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
};

type StoredGoogleSession = {
  accessToken: string;
  expiresAt: number;
};

function buildRedirectUri() {
  return `${window.location.origin}/`;
}

function generateRandomString(length: number) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => (value % 36).toString(36)).join("");
}

function getSessionKey(service: "calendar" | "gmail") {
  return service === "calendar" ? GOOGLE_CALENDAR_SESSION_KEY : GOOGLE_GMAIL_SESSION_KEY;
}

function saveStoredGoogleSession(
  service: "calendar" | "gmail",
  session: StoredGoogleSession,
) {
  window.sessionStorage.setItem(getSessionKey(service), JSON.stringify(session));
}

export function getStoredGoogleAccessToken(service: "calendar" | "gmail") {
  const raw = window.sessionStorage.getItem(getSessionKey(service));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredGoogleSession;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(getSessionKey(service));
      return null;
    }

    return parsed.accessToken;
  } catch {
    window.sessionStorage.removeItem(getSessionKey(service));
    return null;
  }
}

export function clearStoredGoogleAccessToken(service: "calendar" | "gmail") {
  window.sessionStorage.removeItem(getSessionKey(service));
}

export function beginGoogleRedirectAuthorization(
  clientId: string,
  service: "calendar" | "gmail",
  scope = CALENDAR_SCOPE,
) {
  const state = generateRandomString(24);
  const pendingAuth: GooglePendingAuth = {
    service,
    scope,
    state,
  };

  window.sessionStorage.setItem(GOOGLE_PENDING_AUTH_KEY, JSON.stringify(pendingAuth));

  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", buildRedirectUri());
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", scope);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  window.location.assign(url.toString());
}

export function completeGoogleRedirectAuthorizationIfNeeded() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return null;
  }

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const error = params.get("error");
  const returnedState = params.get("state");
  const expiresIn = Number(params.get("expires_in") ?? "0");

  const currentUrl = new URL(window.location.href);
  currentUrl.hash = "";
  window.history.replaceState({}, document.title, currentUrl.toString());

  const rawPending = window.sessionStorage.getItem(GOOGLE_PENDING_AUTH_KEY);
  if (!rawPending) {
    if (error) {
      throw new Error(`Google sign-in failed: ${error}`);
    }
    return null;
  }

  const pendingAuth = JSON.parse(rawPending) as GooglePendingAuth;
  window.sessionStorage.removeItem(GOOGLE_PENDING_AUTH_KEY);

  if (error) {
    throw new Error(`Google sign-in failed: ${error}`);
  }

  if (!accessToken || !returnedState || returnedState !== pendingAuth.state) {
    throw new Error("Google sign-in returned an invalid or mismatched response.");
  }

  if (expiresIn > 0) {
    saveStoredGoogleSession(pendingAuth.service, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    void saveGoogleSessionToken(pendingAuth.service, accessToken).catch(() => {
      // Keyring write is best-effort; session storage remains the UI source of truth.
    });
  }

  return {
    accessToken,
    service: pendingAuth.service,
  } satisfies GoogleRedirectAuthResult;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  title: string,
  start: Date,
  end: Date,
) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: "Created by JARVIS",
        start: {
          dateTime: start.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: timezone,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Calendar API request failed with ${response.status}: ${errorText}`,
    );
  }

  return response.json() as Promise<{ htmlLink?: string; summary?: string }>;
}

export async function listTodayGoogleCalendarEvents(accessToken: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Calendar event list failed with ${response.status}: ${errorText}`,
    );
  }

  const body = (await response.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  return (body.items ?? []).map(
    (item) =>
      ({
        id: item.id ?? "",
        summary: item.summary ?? "Untitled event",
        start: item.start?.dateTime ?? item.start?.date ?? null,
        end: item.end?.dateTime ?? item.end?.date ?? null,
        htmlLink: item.htmlLink ?? null,
      }) satisfies GoogleCalendarEventRecord,
  );
}
