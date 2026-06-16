import type { ReactNode } from "react";
import { useJarvisAppRootComposition } from "./useJarvisAppRootComposition";

export function useJarvisAppRoot(): ReactNode {
  return useJarvisAppRootComposition();
}
