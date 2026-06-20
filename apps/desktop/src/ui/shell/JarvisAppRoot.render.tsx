import { ReactNode } from "react";

import { MODEL_PROVIDER_LABELS } from "../../features/legacy/appHelpers";
import { executeUiQuickAction } from "../model/uiActionAdapter";
import { workspaceRegistry } from "../model/workspaceRegistry";
import { JarvisWorkspaceId } from "../model/jarvisTypes";
import { JarvisAppProvider } from "../context/JarvisAppContext";
import QuickBar from "./QuickBar";
import AppLaunchpad from "./AppLaunchpad";
import HomeSurface from "./HomeSurface";
import HomeHero from "./HomeHero";
import JarvisShell from "./JarvisShell";
import CockpitOverlay from "../cockpit/CockpitOverlay";
import GatewayTracePanel from "../cockpit/GatewayTracePanel";
import FloatingPanelHost from "../floating/FloatingPanelHost";
import SystemDrawer from "../settings/SystemDrawer";
import JarvisSystemDrawer from "../settings/drawer/JarvisSystemDrawer";
import CommandWorkspace from "../workspaces/CommandWorkspace";
import VisionWorkspace from "../workspaces/VisionWorkspace";
import MemoryWorkspace from "../workspaces/MemoryWorkspace";
import AutomationWorkspace from "../workspaces/AutomationWorkspace";
import WorkspacesWorkspace from "../workspaces/WorkspacesWorkspace";
import ConnectionsWorkspace from "../workspaces/ConnectionsWorkspace";
import ModelsWorkspace from "../workspaces/ModelsWorkspace";
import BuilderWorkspace from "../workspaces/BuilderWorkspace";
import { jarvisModules } from "./jarvisModules";
import JarvisPanelContent from "./JarvisPanelContent";
import type { JarvisAppRootRenderProps } from "./jarvisAppRootTypes";

export default function JarvisAppRootRender(props: JarvisAppRootRenderProps) {
  const {
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
  } = props;

  const {
    cockpitSignals,
    cockpitMissionPrompts,
    jarvisHomeApps,
    activeHomeApp,
    activeHomeAppRecord,
    memoryTotal,
    connectedIntegrations,
  } = shellViewModel;

  const systemDrawerContent = (
    <JarvisSystemDrawer drawerContext={drawerContext} />
  );

  const workspaceRenderers: Record<JarvisWorkspaceId, ReactNode> = {
    command: <CommandWorkspace title={workspaceRegistry.command.title} summary={workspaceRegistry.command.summary} sections={workspaceSections.command} />,
    vision: <VisionWorkspace title={workspaceRegistry.vision.title} summary={workspaceRegistry.vision.summary} sections={workspaceSections.vision} />,
    memory: <MemoryWorkspace title={workspaceRegistry.memory.title} summary={workspaceRegistry.memory.summary} sections={workspaceSections.memory} />,
    automation: <AutomationWorkspace title={workspaceRegistry.automation.title} summary={workspaceRegistry.automation.summary} sections={workspaceSections.automation} />,
    workspaces: <WorkspacesWorkspace title={workspaceRegistry.workspaces.title} summary={workspaceRegistry.workspaces.summary} sections={workspaceSections.workspaces} />,
    connections: <ConnectionsWorkspace title={workspaceRegistry.connections.title} summary={workspaceRegistry.connections.summary} sections={workspaceSections.connections} />,
    models: <ModelsWorkspace title={workspaceRegistry.models.title} summary={workspaceRegistry.models.summary} sections={workspaceSections.models} />,
    builder: <BuilderWorkspace title={workspaceRegistry.builder.title} summary={workspaceRegistry.builder.summary} sections={workspaceSections.builder} />,
  };

  const quickActionLabels: Record<string, string> = {
    listen: "Listen",
    open_cockpit: "Cockpit",
    open_system_drawer: "Systems",
    create_daily_brief: "Brief",
    read_screen: "Read screen",
    select_ocr_area: "Select area",
    open_ocr_panel: "OCR panel",
    list_birthdays: "Birthdays",
    open_memory_panel: "Memory panel",
    show_ocr_watches: "OCR watches",
    list_desktop_schedules: "Schedules",
    open_automation_panel: "Automation panel",
    open_coding_workspace: "Coding workspace",
    list_desktop_projects: "Projects",
    open_workspaces_panel: "Workspace panel",
    show_unread_emails: "Unread email",
    spotify_status: "Spotify",
    open_integrations_panel: "Connections panel",
    open_models_workspace: "Models",
    run_project_checks: "Run checks",
    open_project_in_vscode: "Open project",
    open_builder_panel: "Builder panel",
  };

  const quickBarShortcuts = workspaceRegistry[uiState.activeWorkspaceId].quickActions.map((actionId) => (
    <button
      type="button"
      key={actionId}
      onClick={() =>
        void executeUiQuickAction(actionId, {
          dispatch: dispatchUi,
          runCommand: (command) => {
            void runCommand(command);
          },
          handleVoiceStart,
        })
      }
      disabled={isRoutingCommand && actionId !== "listen" && actionId !== "open_cockpit" && actionId !== "open_system_drawer"}
    >
      {quickActionLabels[actionId] ?? actionId}
    </button>
  ));

  const quickBarNode = (
    <QuickBar
      visible={uiState.quickBar.visible}
      placement={uiState.quickBar.placement}
      position={uiState.quickBar.position}
      voicePhase={panelContentProps.voiceSessionPhase}
      brainLabel={
        conversationBackend === "ollama"
          ? "Ollama"
          : conversationBackend === "auto"
          ? "Auto"
          : "Heuristics"
      }
      input={shellBarInput}
      onInputChange={setShellBarInput}
      onSubmit={submitShellBarCommand}
      onListen={handleVoiceStart}
      onHide={() => dispatchUi({ type: "setQuickBarVisibility", visible: false })}
      onRestore={() => dispatchUi({ type: "setQuickBarVisibility", visible: true })}
      onPinToggle={() => pinShellBar(shellBarPlacement === "top" ? "bottom" : "top")}
      onStartDrag={(clientX, clientY, rect) =>
        setShellBarDragState({
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top,
        })
      }
      shortcuts={quickBarShortcuts}
      isRoutingCommand={isRoutingCommand}
    />
  );

  const cockpitOverlayNode = (
    <CockpitOverlay
      open={uiState.isCockpitOpen}
      title={`${assistantName} operating layer`}
      subtitle="Focused command space for missions, modules, and live state. The normal app stays underneath, but this is the use-it-like-JARVIS surface."
      actions={
        <>
          <button className="secondary-button" type="button" onClick={handleVoiceStart}>
            Listen
          </button>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "closeCockpit" })}>
            Exit cockpit
          </button>
        </>
      }
      core={
        <div className="cockpit-core-card">
          <div className={`cockpit-core ${panelContentProps.voiceSessionPhase}`}>
            <span>{assistantName.slice(0, 1).toUpperCase()}</span>
          </div>
          <h3>{panelContentProps.voiceSessionPhase === "listening" ? "Listening" : panelContentProps.voiceSessionPhase === "processing" ? "Thinking" : "Ready"}</h3>
          <p>{statusMessage}</p>
        </div>
      }
      signals={
        <div className="cockpit-signal-grid">
          {cockpitSignals.map((signal) => (
            <div className="cockpit-signal" key={signal.label}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
            </div>
          ))}
        </div>
      }
      missions={
        <div className="cockpit-mission-card">
          <p className="section-kicker">Mission Launcher</p>
          <div className="cockpit-mission-grid">
            {cockpitMissionPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => {
                  setInput(prompt);
                  void runCommand(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      }
      modules={
        <div className="cockpit-module-stack">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowGatewayTrace((current) => !current)}
          >
            {showGatewayTrace ? "Hide gateway trace" : "Show gateway trace"}
          </button>
          {showGatewayTrace ? (
            <GatewayTracePanel
              livePreview={gatewayPreview}
              livePreviewError={gatewayPreviewError}
              isPreviewing={isPreviewingGateway}
              onRunCommand={(command) => {
                void runCommand(command);
              }}
            />
          ) : null}
          <div className="cockpit-module-dock">
            <p className="section-kicker">Modules</p>
            <div className="cockpit-module-grid">
              {jarvisModules.map((module) => (
                <button
                  className={`accent-${module.accent}`}
                  type="button"
                  key={module.id}
                  onClick={() => openJarvisPanel(module.id)}
                >
                  <span>{module.name}</span>
                  <small>{module.description}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );

  const floatingPanelsNode = (
    <FloatingPanelHost
      panels={jarvisPanels}
      titleForPanel={(panelId) => jarvisModules.find((module) => module.id === panelId)?.name ?? panelId}
      accentForPanel={(panelId) => jarvisModules.find((module) => module.id === panelId)?.accent ?? "cyan"}
      onStartDrag={(panelId, clientX, clientY, rect) =>
        setPanelDragState({
          id: panelId,
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top,
        })
      }
      onToggle={toggleJarvisPanel}
      onClose={(panelId) => closeJarvisPanel(panelId)}
      renderPanelContent={(panel) => (
        <JarvisPanelContent panel={panel} {...panelContentProps} />
      )}
    />
  );

  const systemDrawerNode = (
    <SystemDrawer
      open={uiState.systemDrawerOpen}
      onClose={() => dispatchUi({ type: "setSystemDrawerOpen", open: false })}
    >
      {systemDrawerContent}
    </SystemDrawer>
  );

  const homeHeroNode = (
    <HomeHero
      assistantName={assistantName}
      statusMessage={statusMessage}
      wakeCueActive={wakeCueActive}
      onPingCore={pingCore}
      onOpenCockpit={() => dispatchUi({ type: "openCockpit" })}
    />
  );

  const launchpadPreview = (
    <article className={`home-app-stage accent-${activeHomeAppRecord.accent}`}>
      <div>
        <p className="section-kicker">{activeHomeAppRecord.kicker}</p>
        <h3>{activeHomeAppRecord.title}</h3>
        <p>{activeHomeAppRecord.description}</p>
      </div>
      <div className="home-app-actions">
        {activeHomeAppRecord.actions.map((action) => (
          <button
            className="secondary-button"
            type="button"
            key={action.label}
            onClick={() => {
              if (action.command === "__listen__") {
                handleVoiceStart();
              } else if (action.command === "__models__") {
                dispatchUi({ type: "setWorkspace", workspaceId: "models" });
                dispatchUi({ type: "setSurface", surface: "workspace" });
              } else if (action.command) {
                setInput(action.command);
                void runCommand(action.command);
              } else if (action.panel) {
                openJarvisPanel(action.panel);
              } else if (action.cockpit) {
                dispatchUi({ type: "openCockpit" });
              }
            }}
            disabled={isRoutingCommand && Boolean(action.command && action.command !== "__listen__" && action.command !== "__models__")}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="home-app-preview">
        {activeHomeApp === "command" ? (
          <>
            <strong>{commandResult?.title ?? "Ready for the next command"}</strong>
            <p>{commandResult?.detail ?? "Type or say a command to route actions through JARVIS."}</p>
          </>
        ) : activeHomeApp === "vision" ? (
          <>
            <strong>{ocrHistory[0]?.target ?? "No OCR yet"}</strong>
            <p>{ocrHistory[0]?.summary ?? "Try `read my screen` or `select OCR area`."}</p>
          </>
        ) : activeHomeApp === "memory" ? (
          <>
            <strong>{memoryTotal} memory cards saved</strong>
            <p>People, travel, expenses, packages, meetings, and school plans all feed your daily brief.</p>
          </>
        ) : activeHomeApp === "automation" ? (
          <>
            <strong>{savedWorkflows.length + ocrWatchTargets.length} active rules</strong>
            <p>OCR watches, saved workflows, schedules, and cross-feature follow-through stay here.</p>
          </>
        ) : activeHomeApp === "workspaces" ? (
          <>
            <strong>{desktopProjects.length} desktop workspace{desktopProjects.length === 1 ? "" : "s"}</strong>
            <p>Open saved app/folder/site bundles or schedule workspace launches.</p>
          </>
        ) : activeHomeApp === "connections" ? (
          <>
            <strong>{connectedIntegrations.length} live connection{connectedIntegrations.length === 1 ? "" : "s"}</strong>
            <p>Google, Gmail, Notion, Spotify, Ollama, and executor settings stay available in the system drawer.</p>
          </>
        ) : activeHomeApp === "models" ? (
          <>
            <strong>{MODEL_PROVIDER_LABELS[modelRouterConfig.defaultProvider]} is the chat default</strong>
            <p>Benchmarks, comparisons, safe drafts, private mode, and provider routing now live in Models.</p>
          </>
        ) : (
          <>
            <strong>{executorStatus?.configured ? "Executor configured" : "Executor not configured"}</strong>
            <p>Project checks, handoffs, and local coding bridge controls live here.</p>
          </>
        )}
      </div>
    </article>
  );

  const homeLaunchpadNode = (
    <AppLaunchpad
      items={jarvisHomeApps.map((app) => ({
        id: app.id,
        title: app.title,
        stat: app.stat,
        accent: app.accent,
      }))}
      activeWorkspaceId={uiState.activeWorkspaceId}
      onSelect={(workspaceId) => dispatchUi({ type: "setWorkspace", workspaceId })}
      preview={launchpadPreview}
      actions={
        <>
          <button className="secondary-button" type="button" onClick={() => dispatchUi({ type: "openCockpit" })}>
            Full cockpit
          </button>
          <button className="secondary-button" type="button" onClick={resetJarvisUiPreferences}>
            Reset layout
          </button>
        </>
      }
      title="Choose a working surface"
      summary="Pick the app you want, run focused actions, and keep advanced config tucked into one system drawer."
    />
  );

  const homeSurface = (
    <HomeSurface
      hero={homeHeroNode}
      dataSphere={null}
      shellSummary={null}
      appLaunchpad={homeLaunchpadNode}
    />
  );

  const jarvisAppContextValue = {
    input,
    setInput,
    isRoutingCommand,
    commandRouter,
    dispatchUi,
  };

  return (
    <main
      className="app-shell"
      onMouseMove={(event) => {
        moveJarvisPanel(event.clientX, event.clientY);
        moveShellBar(event.clientX, event.clientY);
      }}
      onMouseUp={() => {
        setPanelDragState(null);
        setShellBarDragState(null);
      }}
      onMouseLeave={() => {
        setPanelDragState(null);
        setShellBarDragState(null);
      }}
    >
      {isOcrSelecting ? (
        <div
          className="ocr-selection-overlay"
          role="presentation"
          onMouseDown={(event) => {
            setOcrSelection({
              startX: event.screenX,
              startY: event.screenY,
              currentX: event.screenX,
              currentY: event.screenY,
              viewStartX: event.clientX,
              viewStartY: event.clientY,
              viewCurrentX: event.clientX,
              viewCurrentY: event.clientY,
            });
          }}
          onMouseMove={(event) => {
            setOcrSelection((current) =>
              current
                ? {
                    ...current,
                    currentX: event.screenX,
                    currentY: event.screenY,
                    viewCurrentX: event.clientX,
                    viewCurrentY: event.clientY,
                  }
                : current,
            );
          }}
          onMouseUp={(event) => {
            if (!ocrSelection) {
              return;
            }
            const rect = {
              x: Math.min(ocrSelection.startX, event.screenX),
              y: Math.min(ocrSelection.startY, event.screenY),
              width: Math.abs(event.screenX - ocrSelection.startX),
              height: Math.abs(event.screenY - ocrSelection.startY),
            };
            if (rect.width < 20 || rect.height < 20) {
              setOcrSelection(null);
              setStatusMessage("OCR selection was too small. Drag a larger box.");
              return;
            }
            void completeOcrSelection(rect);
          }}
        >
          <div className="ocr-selection-help">
            <strong>Select OCR area</strong>
            <span>Drag a box over text. Press Cancel to stop.</span>
            <button
              className="secondary-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsOcrSelecting(false);
                setOcrSelection(null);
                setStatusMessage("OCR selection cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
          {selectionRect ? (
            <div
              className="ocr-selection-box"
              style={{
                left: `${selectionRect.left}px`,
                top: `${selectionRect.top}px`,
                width: `${selectionRect.width}px`,
                height: `${selectionRect.height}px`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      <JarvisAppProvider value={jarvisAppContextValue}>
        <JarvisShell
          uiState={uiState}
          quickBar={quickBarNode}
          cockpitOverlay={cockpitOverlayNode}
          floatingPanels={floatingPanelsNode}
          systemDrawer={systemDrawerNode}
          homeSurface={homeSurface}
          workspaceRenderers={workspaceRenderers}
          onBackHome={() => dispatchUi({ type: "setSurface", surface: "home" })}
        />
      </JarvisAppProvider>
      {/* Legacy vertically stacked UI removed after migration into shell/workspaces. */}
    </main>
  );
}
