import { useCallback, useState } from "react";

import type {
  CommandIntent,
  PendingClarification,
  RunCommandOutcome,
  SavedWorkflowRecord,
  TrainingModeSession,
} from "../features/command/jarvisCommandTypes";
import type { VoiceSessionPhase } from "../types/voice";
import {
  describeCommandIntent,
  getErrorDetail,
  isCancelTrainingModeCommand,
  splitWorkflowCommand,
} from "../features/legacy/appHelpers";

type TrainingModeActions = {
  setTeachingTargetPhrase: (phrase: string | null) => void;
  setPendingClarification: (value: PendingClarification | null) => void;
  setCommandResult: (result: { title: string; detail: string }) => void;
  setStatusMessage: (message: string) => void;
  setVoiceSessionPhase: (phase: VoiceSessionPhase) => void;
  appendConversationTurn: (role: "user" | "jarvis", text: string) => void;
  speakIfEnabled: (text: string) => void;
  openFollowUpWindow: (reason: "reply" | "wake" | "clarification") => void;
  teachJarvisMeaning: (
    phrase: string,
    meaning: string,
  ) => Promise<{ resolvedIntent: CommandIntent; familyLabel: string }>;
  teachJarvisWorkflow: (phrase: string, steps: string[]) => SavedWorkflowRecord;
};

/** Wave 10 S30: training mode session state + handlers peeled from JarvisAppRoot.logic. */
export function useJarvisTrainingMode(actions: TrainingModeActions) {
  const [trainingModeSession, setTrainingModeSession] = useState<TrainingModeSession | null>(null);

  const startTrainingMode = useCallback(
    (targetCount = 5) => {
      setTrainingModeSession({
        targetCount,
        currentIndex: 1,
        phase: "awaiting_phrase",
        pendingPhrase: null,
        learnedExamples: [],
      });
      actions.setTeachingTargetPhrase(null);
      actions.setPendingClarification(null);
      actions.setCommandResult({
        title: "Training mode started",
        detail:
          "Give me example phrase 1. After that, I will ask what it should mean. Say cancel training anytime to stop.",
      });
      actions.setStatusMessage("JARVIS training mode is listening for example phrase 1.");
      actions.setVoiceSessionPhase("ready");
      actions.appendConversationTurn(
        "jarvis",
        `Training mode started. Give me example phrase 1 of ${targetCount}.`,
      );
      actions.speakIfEnabled(`Training mode started. Give me example phrase 1.`);
      actions.openFollowUpWindow("reply");
    },
    [actions],
  );

  const handleTrainingModeInput = useCallback(
    async (command: string, session: TrainingModeSession): Promise<RunCommandOutcome> => {
      if (isCancelTrainingModeCommand(command)) {
        setTrainingModeSession(null);
        actions.setCommandResult({
          title: "Training mode cancelled",
          detail:
            session.learnedExamples.length > 0
              ? `Saved ${session.learnedExamples.length} example${session.learnedExamples.length === 1 ? "" : "s"} before stopping.`
              : "No examples were saved.",
        });
        actions.setStatusMessage("Training mode stopped.");
        actions.setVoiceSessionPhase("ready");
        actions.appendConversationTurn("jarvis", "Training mode stopped.");
        actions.speakIfEnabled("Training mode stopped.");
        return { status: "completed" };
      }

      if (session.phase === "awaiting_phrase") {
        const phrase = command.trim().replace(/^["']|["']$/g, "");
        if (!phrase) {
          actions.setCommandResult({
            title: "Training needs a phrase",
            detail: `Give me example phrase ${session.currentIndex}, or say cancel training.`,
          });
          actions.speakIfEnabled(`Give me example phrase ${session.currentIndex}.`);
          return { status: "clarification" };
        }

        setTrainingModeSession({
          ...session,
          phase: "awaiting_meaning",
          pendingPhrase: phrase,
        });
        actions.setCommandResult({
          title: "Training phrase captured",
          detail: `Phrase ${session.currentIndex}: "${phrase}". Now tell me what it should mean, like "play blinding lights on spotify" or "save this to notion".`,
        });
        actions.setStatusMessage("Training mode is waiting for the intended meaning.");
        actions.setVoiceSessionPhase("ready");
        actions.appendConversationTurn("jarvis", `Got the phrase: ${phrase}. What should it mean?`);
        actions.speakIfEnabled(`Got it. What should ${phrase} mean?`);
        actions.openFollowUpWindow("reply");
        return { status: "clarification" };
      }

      const phrase = session.pendingPhrase;
      if (!phrase) {
        setTrainingModeSession({
          ...session,
          phase: "awaiting_phrase",
          pendingPhrase: null,
        });
        return { status: "clarification" };
      }

      const meaning = command.trim();
      try {
        const workflowSteps = splitWorkflowCommand(meaning);
        const resolvedLabel = workflowSteps
          ? `Workflow: ${actions.teachJarvisWorkflow(phrase, workflowSteps).name}`
          : describeCommandIntent((await actions.teachJarvisMeaning(phrase, meaning)).resolvedIntent);

        const learnedExamples = [
          ...session.learnedExamples,
          { phrase, meaning, label: resolvedLabel },
        ];

        if (learnedExamples.length >= session.targetCount) {
          setTrainingModeSession(null);
          actions.setCommandResult({
            title: "Training complete",
            detail: `Saved ${learnedExamples.length} examples: ${learnedExamples
              .map((entry) => `"${entry.phrase}" -> ${entry.label}`)
              .join(" | ")}`,
          });
          actions.setStatusMessage("JARVIS training mode completed.");
          actions.setVoiceSessionPhase("ready");
          actions.appendConversationTurn(
            "jarvis",
            `Training complete. I saved ${learnedExamples.length} examples.`,
          );
          actions.speakIfEnabled(`Training complete. I saved ${learnedExamples.length} examples.`);
          return { status: "completed" };
        }

        const nextIndex = session.currentIndex + 1;
        setTrainingModeSession({
          targetCount: session.targetCount,
          currentIndex: nextIndex,
          phase: "awaiting_phrase",
          pendingPhrase: null,
          learnedExamples,
        });
        actions.setCommandResult({
          title: "Training example saved",
          detail: `Saved "${phrase}" as ${resolvedLabel}. Give me example phrase ${nextIndex} of ${session.targetCount}.`,
        });
        actions.setStatusMessage(`Training mode saved example ${learnedExamples.length}.`);
        actions.setVoiceSessionPhase("ready");
        actions.appendConversationTurn(
          "jarvis",
          `Saved that. Give me example phrase ${nextIndex} of ${session.targetCount}.`,
        );
        actions.speakIfEnabled(`Saved that. Give me example phrase ${nextIndex}.`);
        actions.openFollowUpWindow("reply");
        return { status: "clarification" };
      } catch (error) {
        actions.setCommandResult({
          title: "Training meaning unclear",
          detail: getErrorDetail(
            error,
            `I could not turn that into a reliable action. Try a clearer meaning for "${phrase}", like "play blinding lights on spotify" or "open coding workspace".`,
          ),
        });
        actions.setStatusMessage("Training mode needs a clearer meaning.");
        actions.setVoiceSessionPhase("ready");
        actions.appendConversationTurn(
          "jarvis",
          `I need a clearer action for ${phrase}. Try saying the meaning again.`,
        );
        actions.speakIfEnabled(`I need a clearer action for ${phrase}. Try saying the meaning again.`);
        actions.openFollowUpWindow("reply");
        return { status: "clarification" };
      }
    },
    [actions],
  );

  return {
    trainingModeSession,
    setTrainingModeSession,
    startTrainingMode,
    handleTrainingModeInput,
  };
}
