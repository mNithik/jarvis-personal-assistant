import { useCallback, useEffect, useState } from "react";

import {
  ApprovalRequest,
  GatewayConfig,
  GatewayEvent,
  GatewayPreview,
  GatewayToolDefinition,
  GatewayTurnResponse,
  TurnRequest,
  gatewayApprove,
  gatewayDeny,
  gatewayRunTurn,
  getGatewayAuditLog,
  getGatewayConfig,
  getGatewayTrace,
  listGatewayTaskRuns,
  listGatewayTools,
  listPendingGatewayApprovals,
  previewGatewayTurn,
  saveGatewayConfig,
  type GatewayTaskRunSummary,
} from "../services/jarvisApi";

export type UseJarvisGatewayOptions = {
  previewInput?: string;
  gatewayHistoryLength?: number;
  traceLimit?: number;
  autoLoad?: boolean;
};

type JarvisGatewayState = {
  config: GatewayConfig | null;
  tools: GatewayToolDefinition[];
  trace: GatewayEvent[];
  pendingApprovals: ApprovalRequest[];
  auditLog: string[];
  taskRuns: GatewayTaskRunSummary[];
  lastTurn: GatewayTurnResponse | null;
  gatewayPreview: GatewayPreview | null;
  gatewayPreviewError: string | null;
  isPreviewingGateway: boolean;
  lastKnowledgeRecall: GatewayEvent | null;
  loading: boolean;
  error: string | null;
};

const defaultState: JarvisGatewayState = {
  config: null,
  tools: [],
  trace: [],
  pendingApprovals: [],
  auditLog: [],
  taskRuns: [],
  lastTurn: null,
  gatewayPreview: null,
  gatewayPreviewError: null,
  isPreviewingGateway: false,
  lastKnowledgeRecall: null,
  loading: true,
  error: null,
};

export function useJarvisGateway(options: UseJarvisGatewayOptions = {}) {
  const {
    previewInput,
    gatewayHistoryLength = 0,
    traceLimit = 20,
    autoLoad = true,
  } = options;

  const [state, setState] = useState<JarvisGatewayState>(defaultState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [config, tools, trace, pendingApprovals, auditLog, taskRuns] = await Promise.all([
        getGatewayConfig(),
        listGatewayTools(),
        getGatewayTrace(traceLimit),
        listPendingGatewayApprovals(),
        getGatewayAuditLog(40),
        listGatewayTaskRuns(12),
      ]);
      setState((current) => ({
        ...current,
        config,
        tools,
        trace,
        pendingApprovals,
        auditLog,
        taskRuns,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [traceLimit]);

  useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  useEffect(() => {
    getGatewayTrace(Math.max(traceLimit, 30))
      .then((trace) => {
        setState((current) => ({
          ...current,
          lastKnowledgeRecall: trace.find((event) => event.kind === "knowledge_recalled") ?? null,
        }));
      })
      .catch(() => {
        setState((current) => ({ ...current, lastKnowledgeRecall: null }));
      });
  }, [gatewayHistoryLength, traceLimit]);

  useEffect(() => {
    if (previewInput === undefined) {
      return;
    }

    const trimmed = previewInput.trim();
    if (!trimmed) {
      setState((current) => ({
        ...current,
        gatewayPreview: null,
        gatewayPreviewError: null,
        isPreviewingGateway: false,
      }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, isPreviewingGateway: true }));
    const timer = window.setTimeout(() => {
      previewGatewayTurn({ command: trimmed, source: "text" })
        .then((preview) => {
          if (cancelled) {
            return;
          }
          setState((current) => ({
            ...current,
            gatewayPreview: preview,
            gatewayPreviewError: null,
            isPreviewingGateway: false,
          }));
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setState((current) => ({
            ...current,
            gatewayPreview: null,
            gatewayPreviewError:
              error instanceof Error ? error.message : "Gateway preview unavailable.",
            isPreviewingGateway: false,
          }));
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewInput]);

  const refreshGatewayPreview = useCallback(async (command: string, source: "text" | "voice") => {
    if (!command.trim()) {
      setState((current) => ({
        ...current,
        gatewayPreview: null,
        gatewayPreviewError: null,
      }));
      return null;
    }

    try {
      const preview = await previewGatewayTurn({ command, source });
      setState((current) => ({
        ...current,
        gatewayPreview: preview,
        gatewayPreviewError: null,
      }));
      return preview;
    } catch (error) {
      setState((current) => ({
        ...current,
        gatewayPreview: null,
        gatewayPreviewError:
          error instanceof Error ? error.message : "Gateway preview unavailable.",
      }));
      return null;
    }
  }, []);

  const runTurn = useCallback(async (request: TurnRequest) => {
    setState((current) => ({ ...current, error: null }));
    try {
      const response = await gatewayRunTurn(request);
      const [trace, pendingApprovals] = await Promise.all([
        getGatewayTrace(traceLimit),
        listPendingGatewayApprovals(),
      ]);
      setState((current) => ({
        ...current,
        lastTurn: response,
        trace,
        pendingApprovals,
        error: null,
      }));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ ...current, error: message }));
      throw error;
    }
  }, [traceLimit]);

  const approve = useCallback(
    async (approvalId: string) => {
      await gatewayApprove(approvalId);
      await refresh();
    },
    [refresh],
  );

  const deny = useCallback(
    async (approvalId: string) => {
      await gatewayDeny(approvalId);
      await refresh();
    },
    [refresh],
  );

  const updateConfig = useCallback(async (config: GatewayConfig) => {
    await saveGatewayConfig(config);
    setState((current) => ({ ...current, config }));
  }, []);

  const setGatewayConfig = useCallback((config: GatewayConfig | null) => {
    setState((current) => ({ ...current, config }));
  }, []);

  const setGatewayPreview = useCallback((gatewayPreview: GatewayPreview | null) => {
    setState((current) => ({ ...current, gatewayPreview }));
  }, []);

  const setGatewayPreviewError = useCallback((gatewayPreviewError: string | null) => {
    setState((current) => ({ ...current, gatewayPreviewError }));
  }, []);

  return {
    config: state.config,
    tools: state.tools,
    trace: state.trace,
    pendingApprovals: state.pendingApprovals,
    auditLog: state.auditLog,
    taskRuns: state.taskRuns,
    lastTurn: state.lastTurn,
    gatewayConfig: state.config,
    gatewayPreview: state.gatewayPreview,
    gatewayPreviewError: state.gatewayPreviewError,
    isPreviewingGateway: state.isPreviewingGateway,
    lastKnowledgeRecall: state.lastKnowledgeRecall,
    loading: state.loading,
    error: state.error,
    refresh,
    runTurn,
    approve,
    deny,
    updateConfig,
    setGatewayConfig,
    setGatewayPreview,
    setGatewayPreviewError,
    refreshGatewayPreview,
  };
}

export function useGateway() {
  return useJarvisGateway();
}
