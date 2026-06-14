import { useState } from "react";

import type {
  PendingClarification,
  SemanticIntentDebugMatch,
} from "../features/command/jarvisCommandTypes";

export function useJarvisSemanticRouting() {
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [lastSemanticIntentMatches, setLastSemanticIntentMatches] = useState<
    SemanticIntentDebugMatch[]
  >([]);
  const [learnedIntentRenameDrafts, setLearnedIntentRenameDrafts] = useState<Record<number, string>>(
    {},
  );

  return {
    pendingClarification,
    setPendingClarification,
    lastSemanticIntentMatches,
    setLastSemanticIntentMatches,
    learnedIntentRenameDrafts,
    setLearnedIntentRenameDrafts,
  };
}
