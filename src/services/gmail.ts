import { beginGoogleRedirectAuthorization } from "./googleCalendar";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type GmailMessageListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    body?: {
      data?: string;
    };
    headers?: Array<{
      name?: string;
      value?: string;
    }>;
    parts?: GmailMessagePart[];
  };
};

type GmailMessagePart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

export type GmailMessageRecord = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  body: string;
};

function formatInternalDate(value?: string) {
  if (!value) {
    return "";
  }

  const millis = Number(value);
  if (Number.isNaN(millis)) {
    return "";
  }

  return new Date(millis).toLocaleString();
}

function getHeader(
  message: GmailMessageResponse,
  headerName: string,
) {
  return (
    message.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === headerName.toLowerCase(),
    )?.value ?? ""
  );
}

function decodeBase64Url(value?: string) {
  if (!value) {
    return "";
  }

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return "";
  }
}

function extractPlainTextFromPart(
  part?: GmailMessagePart | GmailMessageResponse["payload"],
): string {
  if (!part) {
    return "";
  }

  if (part.mimeType === "text/plain") {
    return decodeBase64Url(part.body?.data).trim();
  }

  const nested = part.parts ?? [];
  for (const child of nested) {
    const childText: string = extractPlainTextFromPart(child);
    if (childText) {
      return childText;
    }
  }

  if (!nested.length && part.body?.data) {
    return decodeBase64Url(part.body.data).trim();
  }

  return "";
}

async function gmailApiRequest<T>(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API request failed with ${response.status}: ${errorText}`);
  }

  return (await response.json()) as T;
}

async function hydrateMessages(
  accessToken: string,
  messages: Array<{ id: string; threadId: string }>,
) {
  const hydrated = await Promise.all(
    messages.map((message) =>
      gmailApiRequest<GmailMessageResponse>(
        accessToken,
        `/users/me/messages/${message.id}?format=full`,
      ),
    ),
  );

  return hydrated.map<GmailMessageRecord>((message) => ({
    id: message.id,
    threadId: message.threadId,
    subject: getHeader(message, "Subject") || "(no subject)",
    from: getHeader(message, "From") || "Unknown sender",
    snippet: message.snippet ?? "",
    date: formatInternalDate(message.internalDate),
    body: extractPlainTextFromPart(message.payload),
  }));
}

export function requestGmailAccessToken(clientId: string) {
  beginGoogleRedirectAuthorization(clientId, "gmail", GMAIL_READONLY_SCOPE);
}

export async function listUnreadGmailMessages(accessToken: string, maxResults = 5) {
  const response = await gmailApiRequest<GmailMessageListResponse>(
    accessToken,
    `/users/me/messages?labelIds=INBOX&maxResults=${maxResults}&q=${encodeURIComponent("is:unread")}`,
  );

  const messages = response.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  return hydrateMessages(accessToken, messages);
}

export async function searchGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 5,
) {
  const response = await gmailApiRequest<GmailMessageListResponse>(
    accessToken,
    `/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
  );

  const messages = response.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  return hydrateMessages(accessToken, messages);
}
