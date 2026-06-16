import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { JarvisAppRootRenderProps, JarvisPanelContentProps } from "../ui/shell/jarvisAppRootTypes";
import type { JarvisSystemDrawerContextValue } from "../ui/settings/drawer/JarvisSystemDrawerContext";
import type { useJarvisShellViewModel } from "./useJarvisShellViewModel";
import type { useJarvisWorkspaceSections } from "./useJarvisWorkspaceSections";
import type { useJarvisShellRouterBridge } from "./useJarvisShellRouterBridge";
import type { JarvisUiAction } from "../ui/model/uiReducer";
import type { JarvisUiState } from "../ui/model/jarvisTypes";
import type { Dispatch } from "react";
import type {
  JarvisPanelId,
  JarvisPanelRecord,
  ModelRouterConfig,
  OcrWatchTarget,
  PanelDragState,
  SavedWorkflowRecord,
  ShellBarDragState,
  ShellBarPlacement,
  DesktopProjectRecord,
} from "../features/command/jarvisCommandTypes";
import type { ConversationBackend } from "../types/voice";
import type { ExecutorStatus } from "../types/voice";
import type { GatewayPreview } from "../services/jarvisApi";
import type { CommandResult } from "./useJarvisShellState";

export type JarvisShellRenderAssemblyParams = {
  drawerContextBag: JarvisSystemDrawerContextValue;
  panelContentProps: Omit<JarvisPanelContentProps, "panel">;
  uiState: JarvisUiState;
  dispatchUi: Dispatch<JarvisUiAction>;
  shellViewModel: ReturnType<typeof useJarvisShellViewModel>;
  workspaceSections: ReturnType<typeof useJarvisWorkspaceSections>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isRoutingCommand: boolean;
  commandRouter: ReturnType<typeof useJarvisShellRouterBridge>;
  statusMessage: string;
  assistantName: string;
  wakeCueActive: boolean;
  gatewayPreview: GatewayPreview | null;
  gatewayPreviewError: string | null;
  isPreviewingGateway: boolean;
  conversationBackend: ConversationBackend;
  shellBarInput: string;
  setShellBarInput: React.Dispatch<React.SetStateAction<string>>;
  submitShellBarCommand: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  shellBarPlacement: ShellBarPlacement;
  pinShellBar: (placement: Exclude<ShellBarPlacement, "free">) => void;
  setShellBarDragState: React.Dispatch<React.SetStateAction<ShellBarDragState>>;
  handleVoiceStart: () => void;
  runCommand: ReturnType<typeof useJarvisShellRouterBridge>["runCommand"];
  executeIntent: ReturnType<typeof useJarvisShellRouterBridge>["executeIntent"];
  jarvisPanels: JarvisPanelRecord[];
  setPanelDragState: React.Dispatch<React.SetStateAction<PanelDragState>>;
  toggleJarvisPanel: (panel: JarvisPanelId) => void;
  closeJarvisPanel: (panel?: JarvisPanelId) => void;
  openJarvisPanel: (panel: JarvisPanelId) => void;
  pingCore: () => Promise<void>;
  resetJarvisUiPreferences: () => void;
  commandResult: CommandResult | null;
  ocrHistory: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["ocrHistory"];
  savedWorkflows: SavedWorkflowRecord[];
  ocrWatchTargets: OcrWatchTarget[];
  desktopProjects: DesktopProjectRecord[];
  modelRouterConfig: ModelRouterConfig;
  executorStatus: ExecutorStatus | null;
  isOcrSelecting: boolean;
  ocrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["ocrSelection"];
  setOcrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["setOcrSelection"];
  setIsOcrSelecting: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["setIsOcrSelecting"];
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
  completeOcrSelection: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["completeOcrSelection"];
  selectionRect: ReturnType<typeof import("./useJarvisOcr").useJarvisOcr>["selectionRect"];
  moveJarvisPanel: (clientX: number, clientY: number) => void;
  moveShellBar: (clientX: number, clientY: number) => void;
};

export function useJarvisShellRenderAssembly(params: JarvisShellRenderAssemblyParams) {
  const {
    drawerContextBag,
    panelContentProps,
    uiState,
    dispatchUi,
    shellViewModel,
    workspaceSections,
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    statusMessage,
    assistantName,
    wakeCueActive,
    gatewayPreview,
    gatewayPreviewError,
    isPreviewingGateway,
    conversationBackend,
    shellBarInput,
    setShellBarInput,
    submitShellBarCommand,
    shellBarPlacement,
    pinShellBar,
    setShellBarDragState,
    handleVoiceStart,
    runCommand,
    executeIntent,
    jarvisPanels,
    setPanelDragState,
    toggleJarvisPanel,
    closeJarvisPanel,
    openJarvisPanel,
    pingCore,
    resetJarvisUiPreferences,
    commandResult,
    ocrHistory,
    savedWorkflows,
    ocrWatchTargets,
    desktopProjects,
    modelRouterConfig,
    executorStatus,
    isOcrSelecting,
    ocrSelection,
    setOcrSelection,
    setIsOcrSelecting,
    setStatusMessage,
    completeOcrSelection,
    selectionRect,
    moveJarvisPanel,
    moveShellBar,
  } = params;

  const [showGatewayTrace, setShowGatewayTrace] = useState(false);

  const drawerContext = useMemo(
    (): JarvisSystemDrawerContextValue => drawerContextBag,
    [drawerContextBag],
  );

  const renderProps: JarvisAppRootRenderProps = {
    uiState,
    dispatchUi,
    shellViewModel,
    workspaceSections,
    drawerContext,
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    statusMessage,
    assistantName,
    wakeCueActive,
    showGatewayTrace,
    setShowGatewayTrace,
    gatewayPreview,
    gatewayPreviewError,
    isPreviewingGateway,
    conversationBackend,
    shellBarInput,
    setShellBarInput,
    submitShellBarCommand,
    shellBarPlacement,
    pinShellBar,
    setShellBarDragState,
    handleVoiceStart,
    runCommand,
    executeIntent,
    jarvisPanels,
    setPanelDragState,
    toggleJarvisPanel,
    closeJarvisPanel,
    openJarvisPanel,
    panelContentProps,
    pingCore,
    resetJarvisUiPreferences,
    commandResult,
    ocrHistory,
    savedWorkflows,
    ocrWatchTargets,
    desktopProjects,
    modelRouterConfig,
    executorStatus,
    isOcrSelecting,
    ocrSelection,
    setOcrSelection,
    setIsOcrSelecting,
    setStatusMessage,
    completeOcrSelection,
    selectionRect,
    moveJarvisPanel,
    moveShellBar,
  };

  return renderProps;
}
