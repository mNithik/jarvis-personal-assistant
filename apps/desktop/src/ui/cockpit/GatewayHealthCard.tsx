import { useEffect, useMemo, useState } from "react";

import type { GatewayConfig, GatewayEvent, JarvisServiceStatus, LocalTurnApiStatus } from "../../services/jarvisApi";
import {
  gatewayMcpCallTool,
  getJarvisServiceStatus,
  getLocalTurnApiStatus,
  getTriggerQueueStatus,
} from "../../services/jarvisApi";

type GatewayHealthCardProps = {
  config: GatewayConfig | null;
  trace: GatewayEvent[];
};

type HealthCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error" | "unknown";
  detail: string;
};

export default function GatewayHealthCard({ config, trace }: GatewayHealthCardProps) {
  const [mcpProbe, setMcpProbe] = useState<string | null>(null);
  const [testingMcp, setTestingMcp] = useState(false);
  const [apiStatus, setApiStatus] = useState<LocalTurnApiStatus | null>(null);
  const [serviceStatus, setServiceStatus] = useState<JarvisServiceStatus | null>(null);
  const [pendingTriggers, setPendingTriggers] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [api, pending, service] = await Promise.all([
          getLocalTurnApiStatus(),
          getTriggerQueueStatus(),
          getJarvisServiceStatus(),
        ]);
        if (!cancelled) {
          setApiStatus(api);
          setPendingTriggers(pending);
          setServiceStatus(service);
        }
      } catch {
        if (!cancelled) {
          setApiStatus(null);
          setPendingTriggers(null);
          setServiceStatus(null);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config?.enabled, config?.channels?.localWsEnabled]);

  const checks = useMemo<HealthCheck[]>(() => {
    if (!config) {
      return [{ id: "config", label: "Gateway config", status: "unknown", detail: "Not loaded" }];
    }

    const rows: HealthCheck[] = [
      {
        id: "enabled",
        label: "Gateway enabled",
        status: config.enabled ? "ok" : "warn",
        detail: config.enabled ? "Takeover active" : "Legacy router only",
      },
      {
        id: "service",
        label: "jarvis-service",
        status:
          serviceStatus === null
            ? "unknown"
            : serviceStatus.running
              ? "ok"
              : "warn",
        detail:
          serviceStatus === null
            ? "Unknown"
            : serviceStatus.running
              ? `Running${serviceStatus.updatedAt ? ` · ${serviceStatus.updatedAt}` : ""}`
              : "Stopped — install with install-jarvis-service.ps1",
      },
      {
        id: "triggers",
        label: "Trigger queue",
        status:
          pendingTriggers === null ? "unknown" : pendingTriggers > 0 ? "warn" : "ok",
        detail:
          pendingTriggers === null
            ? "Unknown"
            : `${pendingTriggers} pending trigger(s)`,
      },
      {
        id: "local-api",
        label: "Local turn API",
        status: !config.channels?.localWsEnabled
          ? "warn"
          : apiStatus?.listening
            ? "ok"
            : "error",
        detail: !config.channels?.localWsEnabled
          ? "Disabled in settings"
          : apiStatus?.listening
            ? `Listening on 127.0.0.1:${apiStatus.port}`
            : apiStatus?.lastError ?? "Not listening",
      },
      {
        id: "training",
        label: "Training export",
        status: config.training?.exportEnabled ? "ok" : "warn",
        detail: config.training?.exportEnabled
          ? "JSONL export enabled"
          : "Opt-in disabled",
      },
      {
        id: "vault",
        label: "Local vault path",
        status: config.knowledge?.localVaultPath?.trim() ? "ok" : "warn",
        detail: config.knowledge?.localVaultPath?.trim() || "Not configured",
      },
      {
        id: "obsidian",
        label: "Obsidian MCP host",
        status: config.knowledge?.obsidianHostId?.trim() ? "ok" : "warn",
        detail: config.knowledge?.obsidianHostId?.trim() || "Not linked",
      },
      {
        id: "budget",
        label: "Turn budgets",
        status: "ok",
        detail: `${config.budgets.maxStepsPerTurn} steps · ${config.budgets.maxWallTimeSeconds}s wall · ${config.budgets.maxRetriesPerStep} retries`,
      },
    ];

    const quotaEvent = trace.find((event) => event.message.includes("Provider quota"));
    if (quotaEvent) {
      rows.push({
        id: "quota",
        label: "Provider quota",
        status: quotaEvent.message.includes("local") ? "ok" : "ok",
        detail: quotaEvent.message,
      });
    }

    const budgetEvent = trace.find((event) => event.message.includes("Turn budgets"));
    if (budgetEvent) {
      rows.push({
        id: "budget-trace",
        label: "Latest budget trace",
        status: "ok",
        detail: budgetEvent.message,
      });
    }

    if (mcpProbe) {
      rows.push({
        id: "mcp-probe",
        label: "MCP probe",
        status: mcpProbe.startsWith("OK") ? "ok" : "error",
        detail: mcpProbe,
      });
    }

    return rows;
  }, [apiStatus, config, mcpProbe, pendingTriggers, serviceStatus, trace]);

  useEffect(() => {
    setMcpProbe(null);
  }, [config?.knowledge?.obsidianHostId, config?.mcpHosts?.length]);

  async function testBuiltinMcp() {
    setTestingMcp(true);
    try {
      const reply = await gatewayMcpCallTool("jarvis-builtin", "get_routines", {});
      setMcpProbe(`OK: ${reply.slice(0, 120)}`);
    } catch (error) {
      setMcpProbe(error instanceof Error ? error.message : String(error));
    } finally {
      setTestingMcp(false);
    }
  }

  return (
    <div className="gateway-followup-card">
      <div className="gateway-trace-header">
        <h3>Gateway health</h3>
        <button className="secondary-button" type="button" disabled={testingMcp} onClick={() => void testBuiltinMcp()}>
          {testingMcp ? "Testing…" : "Test MCP"}
        </button>
      </div>
      <ul className="memory-list">
        {checks.map((check) => (
          <li className={`memory-meta gateway-health-${check.status}`} key={check.id}>
            <strong>{check.label}</strong>: {check.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
