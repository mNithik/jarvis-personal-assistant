import { createContext, ReactNode, useContext } from "react";
import { FormEvent } from "react";
import type { CommandIntent, RunCommandOutcome } from "../../features/legacy/appHelpers";
import type { JarvisUiAction } from "../model/uiReducer";

export type RunCommandOptions = {
  appendUserTurn?: boolean;
  allowChaining?: boolean;
  bypassGatewayConfirmation?: boolean;
};

export type JarvisCommandRouter = {
  routeCommand: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  routeCommandFromVoice: (transcript: string) => Promise<void>;
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  runCommand: (trimmedInput: string, options?: RunCommandOptions) => Promise<RunCommandOutcome>;
};

export type JarvisAppContextValue = {
  input: string;
  setInput: (value: string) => void;
  isRoutingCommand: boolean;
  commandRouter: JarvisCommandRouter;
  dispatchUi: (action: JarvisUiAction) => void;
};

const JarvisAppContext = createContext<JarvisAppContextValue | null>(null);

export function JarvisAppProvider({
  value,
  children,
}: {
  value: JarvisAppContextValue;
  children: ReactNode;
}) {
  return <JarvisAppContext.Provider value={value}>{children}</JarvisAppContext.Provider>;
}

export function useJarvisApp() {
  const context = useContext(JarvisAppContext);
  if (!context) {
    throw new Error("useJarvisApp must be used within JarvisAppProvider");
  }
  return context;
}

export function useJarvisCommandRouter() {
  return useJarvisApp().commandRouter;
}
