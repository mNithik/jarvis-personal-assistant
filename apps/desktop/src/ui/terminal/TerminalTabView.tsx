import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { spawn, type IPty } from "tauri-pty";

import type { CliPreset } from "./cliPresets";
import { jarvisTerminalTheme } from "./terminalTheme";

type TerminalTabViewProps = {
  isActive: boolean;
  preset: CliPreset;
  workingDirectory: string | null;
  startupSequence: string[] | null;
  onStatusChange: (status: "idle" | "running" | "exited" | "error", detail?: string) => void;
  onStartupComplete: () => void;
};

export function TerminalTabView({
  isActive,
  preset,
  workingDirectory,
  startupSequence,
  onStatusChange,
  onStartupComplete,
}: TerminalTabViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const spawnedRef = useRef(false);
  const startupSentRef = useRef(false);

  useEffect(() => {
    if (!isActive || !containerRef.current || spawnedRef.current) {
      return;
    }

    const container = containerRef.current;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: jarvisTerminalTheme,
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    spawnedRef.current = true;
    onStatusChange("running");

    let disposed = false;

    const spawnOptions: {
      cols: number;
      rows: number;
      cwd?: string;
    } = {
      cols: term.cols,
      rows: term.rows,
    };
    if (workingDirectory?.trim()) {
      spawnOptions.cwd = workingDirectory.trim();
    }

    let pty: IPty;
    try {
      pty = spawn(preset.command, preset.args, spawnOptions);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      term.writeln(`Failed to start ${preset.label}: ${detail}`);
      onStatusChange("error", detail);
      return;
    }

    ptyRef.current = pty;

    const dataDisposable = pty.onData((data) => {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      term.write(text);
    });

    const inputDisposable = term.onData((data) => {
      pty.write(data);
    });

    const exitDisposable = pty.onExit(({ exitCode }) => {
      if (!disposed) {
        onStatusChange("exited", exitCode === 0 ? undefined : `Exit code ${exitCode}`);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      pty.resize(term.cols, term.rows);
    });
    resizeObserver.observe(container);

    const windowResize = () => {
      fitAddon.fit();
      pty.resize(term.cols, term.rows);
    };
    window.addEventListener("resize", windowResize);

    return () => {
      disposed = true;
      dataDisposable.dispose();
      inputDisposable.dispose();
      exitDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", windowResize);
      try {
        pty.kill();
      } catch {
        // Process may already be gone.
      }
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      ptyRef.current = null;
      spawnedRef.current = false;
      startupSentRef.current = false;
    };
  }, [isActive, onStatusChange, preset, workingDirectory]);

  useEffect(() => {
    if (!isActive || !startupSequence?.length || startupSentRef.current || !ptyRef.current) {
      return;
    }

    startupSentRef.current = true;
    const pty = ptyRef.current;
    let index = 0;

    const sendNext = () => {
      if (index >= startupSequence.length) {
        onStartupComplete();
        return;
      }
      pty.write(`${startupSequence[index]}\r`);
      index += 1;
      window.setTimeout(sendNext, 450);
    };

    const timer = window.setTimeout(sendNext, 700);
    return () => window.clearTimeout(timer);
  }, [isActive, onStartupComplete, startupSequence]);

  return (
    <div
      className={`terminal-viewport${isActive ? " terminal-viewport-active" : ""}`}
      ref={containerRef}
    />
  );
}
