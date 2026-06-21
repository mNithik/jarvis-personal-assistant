import { useCallback, useEffect, useMemo, useState } from "react";

import { detectCodingClis, readHandoffPrompt, type CodingCliStatus } from "../../services/jarvisApi";
import type { BuildHandoffArtifact } from "../../types/jarvis";
import type { ExecutorStatus } from "../../types/voice";
import {
  buildHandoffLaunchSequence,
  getPresets,
  isCliAvailable,
  type TerminalTabId,
  type TerminalTabStatus,
} from "./cliPresets";

export type PendingHandoffLaunch = TerminalTabId | null;

type TabState = {
  status: TerminalTabStatus;
  detail?: string;
  touched: boolean;
};

const DEFAULT_CLI_STATUS: CodingCliStatus = {
  pwsh: false,
  powershell: true,
  claude: false,
  codex: false,
  preferredShell: "powershell",
};

export function useJarvisTerminal(args: {
  executorStatus: ExecutorStatus | null;
  handoffArtifact: BuildHandoffArtifact | null;
  pendingHandoffLaunch: PendingHandoffLaunch;
  onPendingHandoffLaunchHandled: () => void;
}) {
  const { executorStatus, handoffArtifact, pendingHandoffLaunch, onPendingHandoffLaunchHandled } =
    args;

  const [activeTabId, setActiveTabId] = useState<TerminalTabId>("shell");
  const [cliStatus, setCliStatus] = useState<CodingCliStatus>(DEFAULT_CLI_STATUS);
  const [tabStates, setTabStates] = useState<Record<TerminalTabId, TabState>>({
    shell: { status: "idle", touched: false },
    claude: { status: "idle", touched: false },
    codex: { status: "idle", touched: false },
  });
  const [startupSequence, setStartupSequence] = useState<string[] | null>(null);
  const [startupTabId, setStartupTabId] = useState<TerminalTabId | null>(null);
  const [restartNonce, setRestartNonce] = useState(0);

  const workingDirectory = useMemo(() => {
    const configured = executorStatus?.workingDirectory?.trim();
    return configured || null;
  }, [executorStatus?.workingDirectory]);

  const presets = useMemo(() => getPresets(cliStatus), [cliStatus]);

  useEffect(() => {
    let cancelled = false;
    void detectCodingClis()
      .then((status) => {
        if (!cancelled) {
          setCliStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCliStatus(DEFAULT_CLI_STATUS);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateTabStatus = useCallback(
    (tabId: TerminalTabId, status: TerminalTabStatus, detail?: string) => {
      setTabStates((current) => ({
        ...current,
        [tabId]: {
          ...current[tabId],
          status,
          detail,
        },
      }));
    },
    [],
  );

  const selectTab = useCallback((tabId: TerminalTabId) => {
    setActiveTabId(tabId);
    setTabStates((current) => ({
      ...current,
      [tabId]: {
        ...current[tabId],
        touched: true,
      },
    }));
  }, []);

  const launchHandoffInTab = useCallback(
    async (tabId: TerminalTabId) => {
      if (!handoffArtifact?.markdownPath) {
        return;
      }
      if (!workingDirectory) {
        updateTabStatus(tabId, "error", "Set executor working directory in the system drawer.");
        selectTab(tabId);
        return;
      }

      try {
        const prompt = await readHandoffPrompt(handoffArtifact.markdownPath);
        const sequence = buildHandoffLaunchSequence(
          tabId,
          workingDirectory,
          prompt,
          handoffArtifact.markdownPath,
        );
        setStartupTabId(tabId);
        setStartupSequence(sequence);
        selectTab(tabId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        updateTabStatus(tabId, "error", detail);
        selectTab(tabId);
      }
    },
    [handoffArtifact, selectTab, updateTabStatus, workingDirectory],
  );

  useEffect(() => {
    if (!pendingHandoffLaunch) {
      return;
    }
    void launchHandoffInTab(pendingHandoffLaunch).finally(() => {
      onPendingHandoffLaunchHandled();
    });
  }, [launchHandoffInTab, onPendingHandoffLaunchHandled, pendingHandoffLaunch]);

  const handleStartupComplete = useCallback(() => {
    setStartupSequence(null);
    setStartupTabId(null);
  }, []);

  const restartActiveTab = useCallback(() => {
    setStartupSequence(null);
    setStartupTabId(null);
    setTabStates((current) => ({
      ...current,
      [activeTabId]: { status: "idle", touched: false },
    }));
    setRestartNonce((value) => value + 1);
    window.setTimeout(() => {
      setTabStates((current) => ({
        ...current,
        [activeTabId]: { status: "idle", touched: true },
      }));
    }, 0);
  }, [activeTabId]);

  return {
    activeTabId,
    cliStatus,
    presets,
    tabStates,
    workingDirectory,
    startupSequence: startupTabId === activeTabId ? startupSequence : null,
    selectTab,
    updateTabStatus,
    launchHandoffInTab,
    handleStartupComplete,
    restartActiveTab,
    restartNonce,
    isCliAvailable,
  };
}
