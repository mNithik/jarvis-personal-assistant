import { ReactNode } from "react";
import { JarvisWorkspaceId } from "../model/jarvisTypes";

type WorkspaceSurfaceProps = {
  activeWorkspaceId: JarvisWorkspaceId;
  renderers: Record<JarvisWorkspaceId, ReactNode>;
};

export default function WorkspaceSurface({
  activeWorkspaceId,
  renderers,
}: WorkspaceSurfaceProps) {
  return <>{renderers[activeWorkspaceId]}</>;
}
