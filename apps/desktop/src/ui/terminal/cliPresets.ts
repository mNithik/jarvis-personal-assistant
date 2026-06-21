import type { CodingCliStatus } from "../../services/jarvisApi";

export type TerminalTabId = "shell" | "claude" | "codex";

export type TerminalTabStatus = "idle" | "running" | "exited" | "missing_cli" | "error";

export type CliPreset = {
  id: TerminalTabId;
  label: string;
  command: string;
  args: string[];
  requiresCli?: keyof Pick<CodingCliStatus, "claude" | "codex">;
};

export function getShellCommand(cliStatus: CodingCliStatus): string {
  if (cliStatus.pwsh) {
    return "pwsh";
  }
  if (cliStatus.powershell) {
    return "powershell";
  }
  return "powershell.exe";
}

export function getPresets(cliStatus: CodingCliStatus): CliPreset[] {
  return [
    {
      id: "shell",
      label: "Shell",
      command: getShellCommand(cliStatus),
      args: [],
    },
    {
      id: "claude",
      label: "Claude",
      command: "claude",
      args: [],
      requiresCli: "claude",
    },
    {
      id: "codex",
      label: "Codex",
      command: "codex",
      args: [],
      requiresCli: "codex",
    },
  ];
}

export function isCliAvailable(
  preset: CliPreset,
  cliStatus: CodingCliStatus,
): boolean {
  if (!preset.requiresCli) {
    return cliStatus.pwsh || cliStatus.powershell;
  }
  return cliStatus[preset.requiresCli];
}

export function buildHandoffLaunchSequence(
  preset: TerminalTabId,
  cwd: string,
  prompt: string,
  markdownPath?: string,
): string[] {
  const escapedCwd = cwd.replace(/"/g, '""');
  const sequences = [`cd "${escapedCwd}"`];

  if (preset === "shell") {
    if (markdownPath) {
      const escapedPath = markdownPath.replace(/"/g, '""');
      sequences.push(`Get-Content -LiteralPath "${escapedPath}"`);
    }
    return sequences;
  }

  const compactPrompt = prompt.replace(/\r?\n/g, " ").replace(/"/g, '""');
  if (preset === "claude") {
    sequences.push(`claude -p "${compactPrompt}"`);
  } else if (preset === "codex") {
    sequences.push(`codex "${compactPrompt}"`);
  }

  return sequences;
}
