import type { JarvisRouterBridgeContext } from "./buildJarvisRouterBridgeState";
import { collectJarvisRouterBridgeContext } from "./jarvisRouterBridgeContext.build";

export function useJarvisRouterBridgeContext(
  bag: JarvisRouterBridgeContext,
): JarvisRouterBridgeContext {
  return collectJarvisRouterBridgeContext(bag);
}
