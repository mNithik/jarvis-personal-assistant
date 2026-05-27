const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
].join(" ");

const SPOTIFY_STATE_KEY = "jarvis.spotify.pkce_state";
const SPOTIFY_VERIFIER_KEY = "jarvis.spotify.pkce_verifier";
const SPOTIFY_SESSION_KEY = "jarvis.spotify.session";

export type SpotifyPlaybackState = {
  isPlaying: boolean;
  title: string | null;
  artist: string | null;
  album: string | null;
  deviceName: string | null;
};

type StoredSpotifySession = {
  accessToken: string;
  expiresAt: number;
};

function getSpotifyRedirectUri() {
  return `${window.location.origin}/`;
}

function base64UrlEncode(bytes: Uint8Array) {
  const binary = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateRandomString(length: number) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => (value % 36).toString(36)).join("");
}

async function buildCodeChallenge(verifier: string) {
  const encoded = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

function storeSpotifySession(session: StoredSpotifySession) {
  window.sessionStorage.setItem(SPOTIFY_SESSION_KEY, JSON.stringify(session));
}

export function getStoredSpotifyAccessToken() {
  const raw = window.sessionStorage.getItem(SPOTIFY_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSpotifySession;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SPOTIFY_SESSION_KEY);
      return null;
    }

    return parsed.accessToken;
  } catch {
    window.sessionStorage.removeItem(SPOTIFY_SESSION_KEY);
    return null;
  }
}

export function clearSpotifySession() {
  window.sessionStorage.removeItem(SPOTIFY_SESSION_KEY);
}

export async function beginSpotifyAuthorization(clientId: string) {
  const state = generateRandomString(24);
  const verifier = generateRandomString(96);
  const challenge = await buildCodeChallenge(verifier);

  window.sessionStorage.setItem(SPOTIFY_STATE_KEY, state);
  window.sessionStorage.setItem(SPOTIFY_VERIFIER_KEY, verifier);

  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getSpotifyRedirectUri());
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("state", state);

  window.location.assign(url.toString());
}

export async function completeSpotifyAuthorizationIfNeeded(clientId: string) {
  const currentUrl = new URL(window.location.href);
  const code = currentUrl.searchParams.get("code");
  const state = currentUrl.searchParams.get("state");
  const error = currentUrl.searchParams.get("error");

  if (error) {
    currentUrl.searchParams.delete("error");
    window.history.replaceState({}, document.title, currentUrl.toString());
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  if (!code || !state) {
    return getStoredSpotifyAccessToken();
  }

  const expectedState = window.sessionStorage.getItem(SPOTIFY_STATE_KEY);
  const verifier = window.sessionStorage.getItem(SPOTIFY_VERIFIER_KEY);

  if (!expectedState || !verifier || state !== expectedState) {
    throw new Error("Spotify authorization state did not match this session.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    code_verifier: verifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "Spotify did not return a usable access token.",
    );
  }

  const session = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  storeSpotifySession(session);

  window.sessionStorage.removeItem(SPOTIFY_STATE_KEY);
  window.sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
  currentUrl.searchParams.delete("code");
  currentUrl.searchParams.delete("state");
  window.history.replaceState({}, document.title, currentUrl.toString());

  return session.accessToken;
}

async function spotifyApiRequest<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 404) {
    throw new Error(
      "Spotify could not find an active playback device. Open Spotify on one of your devices and start playback once first.",
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Spotify playback control needs a Premium account and an active playback device.",
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify API request failed with ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function getSpotifyPlaybackState(
  accessToken: string,
): Promise<SpotifyPlaybackState | null> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify playback lookup failed with ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    is_playing?: boolean;
    device?: { name?: string | null };
    item?: {
      name?: string | null;
      album?: { name?: string | null };
      artists?: Array<{ name?: string | null }>;
    } | null;
  };

  return {
    isPlaying: Boolean(payload.is_playing),
    title: payload.item?.name ?? null,
    artist: payload.item?.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || null,
    album: payload.item?.album?.name ?? null,
    deviceName: payload.device?.name ?? null,
  };
}

export function spotifyResumePlayback(accessToken: string) {
  return spotifyApiRequest<void>(accessToken, "/me/player/play", {
    method: "PUT",
  });
}

export function spotifyPausePlayback(accessToken: string) {
  return spotifyApiRequest<void>(accessToken, "/me/player/pause", {
    method: "PUT",
  });
}

export function spotifySkipToNext(accessToken: string) {
  return spotifyApiRequest<void>(accessToken, "/me/player/next", {
    method: "POST",
  });
}

export function spotifySkipToPrevious(accessToken: string) {
  return spotifyApiRequest<void>(accessToken, "/me/player/previous", {
    method: "POST",
  });
}
