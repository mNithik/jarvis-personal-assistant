import { buildAutomationWorkspaceSections } from "../ui/workspaces/sections/AutomationSections";
import { buildBuilderWorkspaceSections } from "../ui/workspaces/sections/BuilderSections";
import { buildCommandWorkspaceSections } from "../ui/workspaces/sections/CommandSections";
import { buildConnectionsWorkspaceSections } from "../ui/workspaces/sections/ConnectionsSections";
import { buildMemoryWorkspaceSections } from "../ui/workspaces/sections/MemorySections";
import { buildModelsWorkspaceSections } from "../ui/workspaces/sections/ModelsSections";
import { buildVisionWorkspaceSections } from "../ui/workspaces/sections/VisionSections";
import { buildWorkspacesWorkspaceSections } from "../ui/workspaces/sections/WorkspacesSections";

export function useJarvisWorkspaceSections(args: Parameters<typeof buildCommandWorkspaceSections>[0] & {
  vision: Parameters<typeof buildVisionWorkspaceSections>[0];
  memory: Parameters<typeof buildMemoryWorkspaceSections>[0];
  workspaces: Parameters<typeof buildWorkspacesWorkspaceSections>[0];
  connections: Parameters<typeof buildConnectionsWorkspaceSections>[0];
  builder: Parameters<typeof buildBuilderWorkspaceSections>[0];
  models: Parameters<typeof buildModelsWorkspaceSections>[0];
  automation: Parameters<typeof buildAutomationWorkspaceSections>[0];
}) {
  return {
    command: buildCommandWorkspaceSections(args),
    vision: buildVisionWorkspaceSections(args.vision),
    memory: buildMemoryWorkspaceSections(args.memory),
    workspaces: buildWorkspacesWorkspaceSections(args.workspaces),
    connections: buildConnectionsWorkspaceSections(args.connections),
    builder: buildBuilderWorkspaceSections(args.builder),
    models: buildModelsWorkspaceSections(args.models),
    automation: buildAutomationWorkspaceSections(args.automation),
  };
}
