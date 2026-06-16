import { useCallback, useEffect } from "react";

import {
  beginGoogleRedirectAuthorization,
  completeGoogleRedirectAuthorizationIfNeeded,
  getStoredGoogleAccessToken,
} from "../services/googleCalendar";
import { listUnreadGmailMessages } from "../services/gmail";
import { requestGmailAccessToken } from "../services/gmail";
import {
  beginSpotifyAuthorization,
  completeSpotifyAuthorizationIfNeeded,
  getSpotifyPlaybackState,
  getStoredSpotifyAccessToken,
} from "../services/spotify";
import {
  saveGoogleCalendarStatus,
  saveNotionStatus,
  saveSpotifyStatus,
} from "../services/jarvisApi";
import type { EmailRecord, GoogleCalendarStatus, NotionStatus, SpotifyStatus } from "../types/jarvis";
import { getErrorDetail } from "../features/legacy/appHelpers";
import type { SpotifyPlaybackState } from "../services/spotify";
import type { Dispatch, SetStateAction } from "react";

type IntegrationCommandResult = {
  title: string;
  detail: string;
};

type IntegrationBootLoaders = {
  loadMemoryView: () => Promise<void>;
  loadBrowserAliases: () => Promise<void>;
  loadLearnedIntents: () => Promise<void>;
  loadGoogleCalendarStatus: () => Promise<void>;
  loadSpotifyStatus: () => Promise<void>;
  loadNotionStatus: () => Promise<void>;
  loadRecentNotes: () => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  loadOllamaStatus: () => Promise<void>;
  loadExecutorStatus: () => Promise<void>;
};

type UseJarvisIntegrationsOptions = IntegrationBootLoaders & {
  googleCalendarClientId: string;
  googleCalendarApiKey: string;
  googleCalendarStatus: GoogleCalendarStatus | null;
  spotifyClientId: string;
  spotifyStatus: SpotifyStatus | null;
  notionTokenInput: string;
  notionDatabaseId: string;
  setGoogleCalendarAccessToken: Dispatch<SetStateAction<string | null>>;
  setGmailAccessToken: Dispatch<SetStateAction<string | null>>;
  setSpotifyAccessToken: Dispatch<SetStateAction<string | null>>;
  setSpotifyPlaybackState: Dispatch<SetStateAction<SpotifyPlaybackState | null>>;
  setRecentEmails: Dispatch<SetStateAction<EmailRecord[]>>;
  setGoogleCalendarStatus: (status: GoogleCalendarStatus) => void;
  setNotionStatus: (status: NotionStatus) => void;
  setNotionTokenInput: (value: string) => void;
  setSpotifyStatus: (status: SpotifyStatus) => void;
  setStatusMessage: (message: string) => void;
  setCommandResult: (result: IntegrationCommandResult | null) => void;
};

/** Wave D: integration config/connect + OAuth redirect boot loaders from JarvisAppRoot.logic */
export function useJarvisIntegrations({
  googleCalendarApiKey,
  googleCalendarClientId,
  googleCalendarStatus,
  loadBrowserAliases,
  loadExecutorStatus,
  loadGoogleCalendarStatus,
  loadLearnedIntents,
  loadMemoryView,
  loadNotionStatus,
  loadOllamaStatus,
  loadRecentFiles,
  loadRecentNotes,
  loadSpotifyStatus,
  notionDatabaseId,
  notionTokenInput,
  setCommandResult,
  setGmailAccessToken,
  setGoogleCalendarAccessToken,
  setGoogleCalendarStatus,
  setNotionStatus,
  setNotionTokenInput,
  setRecentEmails,
  setSpotifyAccessToken,
  setSpotifyPlaybackState,
  setSpotifyStatus,
  setStatusMessage,
  spotifyClientId,
  spotifyStatus,
}: UseJarvisIntegrationsOptions) {
  const saveGoogleCalendarConfig = useCallback(async () => {
    try {
      const status = await saveGoogleCalendarStatus(googleCalendarClientId, googleCalendarApiKey);
      setGoogleCalendarStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Google Calendar config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Google Calendar config",
        detail: "JARVIS could not update the Google Calendar API settings.",
      });
    }
  }, [
    googleCalendarApiKey,
    googleCalendarClientId,
    setCommandResult,
    setGoogleCalendarStatus,
    setStatusMessage,
  ]);

  const connectGoogleCalendar = useCallback(async () => {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google Calendar not configured",
        detail: "Save your Google Calendar client ID and API key first.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Google Calendar sign-in...");
      setCommandResult({
        title: "Google Calendar sign-in",
        detail:
          "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      beginGoogleRedirectAuthorization(
        googleCalendarClientId.trim(),
        "calendar",
        "https://www.googleapis.com/auth/calendar.events.owned",
      );
    } catch (error) {
      setCommandResult({
        title: "Google Calendar connection failed",
        detail: getErrorDetail(error, "JARVIS could not connect to Google Calendar right now."),
      });
    }
  }, [googleCalendarClientId, googleCalendarStatus?.configured, setCommandResult, setStatusMessage]);

  const connectGmail = useCallback(async () => {
    if (!googleCalendarStatus?.configured || !googleCalendarClientId.trim()) {
      setCommandResult({
        title: "Google account not configured",
        detail: "Save your Google client ID and API key first, then connect Gmail.",
      });
      return;
    }

    try {
      setStatusMessage("Opening Gmail sign-in...");
      setCommandResult({
        title: "Gmail sign-in",
        detail:
          "JARVIS is redirecting this app through Google sign-in and will return here after consent.",
      });
      requestGmailAccessToken(googleCalendarClientId.trim());
    } catch (error) {
      setCommandResult({
        title: "Gmail connection failed",
        detail: getErrorDetail(error, "JARVIS could not connect to Gmail right now."),
      });
    }
  }, [googleCalendarClientId, googleCalendarStatus?.configured, setCommandResult, setStatusMessage]);

  const saveNotionConfig = useCallback(async () => {
    try {
      const status = await saveNotionStatus(notionTokenInput, notionDatabaseId);
      setNotionStatus(status);
      setNotionTokenInput("");
      setStatusMessage(status.message);
      setCommandResult({
        title: "Notion config saved",
        detail: status.hasToken
          ? `The Notion token is saved locally and hidden from the input for safety. ${status.message}`
          : status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Notion config",
        detail: "JARVIS could not update the Notion notes settings.",
      });
    }
  }, [
    notionDatabaseId,
    notionTokenInput,
    setCommandResult,
    setNotionStatus,
    setNotionTokenInput,
    setStatusMessage,
  ]);

  const saveSpotifyConfig = useCallback(async () => {
    try {
      const status = await saveSpotifyStatus(spotifyClientId);
      setSpotifyStatus(status);
      setStatusMessage(status.message);
      setCommandResult({
        title: "Spotify config saved",
        detail: status.message,
      });
    } catch {
      setCommandResult({
        title: "Could not save Spotify config",
        detail: "JARVIS could not update the Spotify app settings.",
      });
    }
  }, [setCommandResult, setSpotifyStatus, setStatusMessage, spotifyClientId]);

  const connectSpotify = useCallback(async () => {
    if (!spotifyStatus?.configured || !spotifyClientId.trim()) {
      setCommandResult({
        title: "Spotify not configured",
        detail: "Save your Spotify client ID first.",
      });
      return;
    }

    await beginSpotifyAuthorization(spotifyClientId.trim());
  }, [spotifyClientId, spotifyStatus?.configured, setCommandResult]);

  const refreshSpotifyPlayback = useCallback(async (accessToken: string) => {
    const playback = await getSpotifyPlaybackState(accessToken);
    setSpotifyPlaybackState(playback);
    return playback;
  }, [setSpotifyPlaybackState]);

  useEffect(() => {
    void loadMemoryView();
    void loadBrowserAliases();
    void loadLearnedIntents();
    void loadGoogleCalendarStatus();
    void loadSpotifyStatus();
    void loadNotionStatus();
    void loadRecentNotes();
    void loadRecentFiles();
    void loadOllamaStatus();
    void loadExecutorStatus();
  }, [
    loadBrowserAliases,
    loadExecutorStatus,
    loadGoogleCalendarStatus,
    loadLearnedIntents,
    loadMemoryView,
    loadNotionStatus,
    loadOllamaStatus,
    loadRecentFiles,
    loadRecentNotes,
    loadSpotifyStatus,
  ]);

  useEffect(() => {
    const storedCalendarToken = getStoredGoogleAccessToken("calendar");
    const storedGmailToken = getStoredGoogleAccessToken("gmail");
    if (storedCalendarToken) {
      setGoogleCalendarAccessToken(storedCalendarToken);
    }
    if (storedGmailToken) {
      setGmailAccessToken(storedGmailToken);
    }
  }, [setGmailAccessToken, setGoogleCalendarAccessToken]);

  useEffect(() => {
    try {
      const authResult = completeGoogleRedirectAuthorizationIfNeeded();
      if (!authResult) {
        return;
      }

      if (authResult.service === "calendar") {
        setGoogleCalendarAccessToken(authResult.accessToken);
        setStatusMessage("Google Calendar is connected for this session.");
        setCommandResult({
          title: "Google Calendar connected",
          detail: "JARVIS can now create events directly through the Calendar API.",
        });
      } else {
        setGmailAccessToken(authResult.accessToken);
        setStatusMessage("Gmail is connected for this session.");
        setCommandResult({
          title: "Gmail connected",
          detail: "JARVIS can now read unread messages and search your inbox.",
        });
        void listUnreadGmailMessages(authResult.accessToken)
          .then((messages) => setRecentEmails(messages))
          .catch(() => setRecentEmails([]));
      }
    } catch (error) {
      setCommandResult({
        title: "Google sign-in failed",
        detail: getErrorDetail(error, "Google sign-in could not be completed."),
      });
    }
  }, [setCommandResult, setGmailAccessToken, setGoogleCalendarAccessToken, setRecentEmails, setStatusMessage]);

  useEffect(() => {
    const storedToken = getStoredSpotifyAccessToken();
    if (storedToken) {
      setSpotifyAccessToken(storedToken);
      void refreshSpotifyPlayback(storedToken).catch(() => {
        setSpotifyPlaybackState(null);
      });
    }
  }, [refreshSpotifyPlayback, setSpotifyAccessToken, setSpotifyPlaybackState]);

  useEffect(() => {
    if (!spotifyClientId.trim()) {
      return;
    }

    void completeSpotifyAuthorizationIfNeeded(spotifyClientId.trim())
      .then((token) => {
        if (!token) {
          return;
        }

        setSpotifyAccessToken(token);
        setStatusMessage("Spotify is connected for this session.");
        setCommandResult({
          title: "Spotify connected",
          detail: "JARVIS can now control playback through the Spotify Web API.",
        });
        return refreshSpotifyPlayback(token);
      })
      .catch((error) => {
        setSpotifyAccessToken(null);
        setSpotifyPlaybackState(null);
        setCommandResult({
          title: "Spotify connection failed",
          detail: getErrorDetail(
            error,
            "JARVIS could not complete the Spotify sign-in flow right now.",
          ),
        });
      });
  }, [
    refreshSpotifyPlayback,
    setCommandResult,
    setSpotifyAccessToken,
    setSpotifyPlaybackState,
    setStatusMessage,
    spotifyClientId,
  ]);

  return {
    saveGoogleCalendarConfig,
    connectGoogleCalendar,
    connectGmail,
    saveNotionConfig,
    saveSpotifyConfig,
    connectSpotify,
    refreshSpotifyPlayback,
  };
}
