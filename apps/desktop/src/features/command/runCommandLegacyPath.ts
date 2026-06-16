import * as J from "../legacy/appHelpers";
import type {
  CommandIntent,
  CrossFeatureSuggestionRecord,
  PendingWorkflowExecution,
  RunCommandOutcome,
} from "./jarvisCommandTypes";
import type { ResolvedCommandRouterDeps } from "./commandRouterTypes";
import { interpretConversationWithOllama } from "../../services/jarvisApi";

type RunCommandAgain = (
  command: string,
  options?: {
    appendUserTurn?: boolean;
    allowChaining?: boolean;
    bypassGatewayConfirmation?: boolean;
  },
) => Promise<RunCommandOutcome>;

/** Wave 12: legacy NL routing tail after gateway prelude. */
export async function runCommandLegacyPath(
  deps: ResolvedCommandRouterDeps,
  trimmedInput: string,
  allowChaining: boolean,
  executeIntent: (intent: CommandIntent) => Promise<boolean>,
  runCommandAgain: RunCommandAgain,
  handleApplyCrossFeatureSuggestion: (
    suggestion: CrossFeatureSuggestionRecord,
  ) => Promise<void>,
): Promise<RunCommandOutcome> {
    const trainingCleanupOutcome = await deps.handleTrainingReviewCleanupCommand(trimmedInput);
    if (trainingCleanupOutcome) {
      return trainingCleanupOutcome;
    }

    const contextStackOutcome = deps.handleConversationContextStackCommand(trimmedInput);
    if (contextStackOutcome) {
      return contextStackOutcome;
    }

    const teachingInstruction = J.parseTeachingInstruction(trimmedInput, deps.teachingTargetPhrase);
    if (teachingInstruction) {
      if (teachingInstruction.kind === "teach_phrase") {
        const taught = await deps.teachJarvisMeaning(
          teachingInstruction.phrase,
          teachingInstruction.meaning,
        );
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Phrase meaning taught",
          detail: `JARVIS learned that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}. Family: ${taught.familyLabel}.`,
        });
        deps.setStatusMessage(`JARVIS learned what "${teachingInstruction.phrase}" means.`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${teachingInstruction.phrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        deps.speakIfEnabled(
          `I'll remember that ${teachingInstruction.phrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
        );
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "teach_workflow") {
        const workflow = deps.teachJarvisWorkflow(
          teachingInstruction.phrase,
          teachingInstruction.steps,
        );
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Workflow meaning taught",
          detail: `Saved "${workflow.triggerPhrase}" as a ${workflow.steps.length}-step workflow: ${workflow.steps.join(" -> ")}.`,
        });
        deps.setStatusMessage(`JARVIS learned the workflow for "${workflow.triggerPhrase}".`);
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll remember that "${workflow.triggerPhrase}" runs ${workflow.steps.length} steps.`,
        );
        deps.speakIfEnabled(`I'll remember that ${workflow.triggerPhrase} runs ${workflow.steps.length} steps.`);
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_music_provider") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          musicProvider: teachingInstruction.provider,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Music preference saved",
          detail: "JARVIS will treat music requests as Spotify-first when the phrasing is ambiguous.",
        });
        deps.setStatusMessage("Music preference saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I'll treat music requests as Spotify-first from now on.");
        deps.speakIfEnabled("I'll treat music requests as Spotify first from now on.");
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_note_app") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          noteApp: teachingInstruction.app,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Note preference saved",
          detail: "JARVIS will keep sending note requests to Notion.",
        });
        deps.setStatusMessage("Note preference saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "I'll keep sending your note requests to Notion.");
        deps.speakIfEnabled("I'll keep sending your note requests to Notion.");
        return { status: "completed" };
      }

      if (teachingInstruction.kind === "set_default_workspace") {
        deps.setUserPreferenceMemory((current) => ({
          ...current,
          defaultWorkspaceName: teachingInstruction.workspaceName,
        }));
        deps.setTeachingTargetPhrase(null);
        deps.setCommandResult({
          title: "Default workspace saved",
          detail: `JARVIS will treat setup-style workspace requests as ${teachingInstruction.workspaceName}.`,
        });
        deps.setStatusMessage("Default workspace saved.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn(
          "jarvis",
          `I'll treat your setup workspace as ${teachingInstruction.workspaceName} from now on.`,
        );
        deps.speakIfEnabled(
          `I'll treat your setup workspace as ${teachingInstruction.workspaceName} from now on.`,
        );
        return { status: "completed" };
      }
    }

    const normalizedDirectCommand = J.normalizeControlCommand(trimmedInput);
    if (
      deps.userPreferenceMemory.musicProvider === "spotify" &&
      ["play something", "play some music", "put on some music", "play music"].includes(
        normalizedDirectCommand,
      )
    ) {
      const completed = await executeIntent({ kind: "spotify_play" });
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (
      deps.userPreferenceMemory.defaultWorkspaceName &&
      [
        "open my setup",
        "open setup",
        "start my setup",
        "start setup",
        "open my default workspace",
        "open default workspace",
      ].includes(normalizedDirectCommand)
    ) {
      const completed = await executeIntent({
        kind: "open_desktop_project",
        query: deps.userPreferenceMemory.defaultWorkspaceName,
      });
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (J.isExplainIntentRoutingCommand(trimmedInput)) {
      const routeLabel = deps.commandResult?.routeLabel ?? deps.currentRouteLabelRef.current ?? "No route recorded yet";
      const matchDetail =
        deps.lastSemanticIntentMatches.length > 0
          ? deps.lastSemanticIntentMatches
              .map(
                (match, index) =>
                  `${index + 1}. ${match.label} (${Math.round(match.score * 100)}%, ${match.source}, matched "${match.matchedExample}")`,
              )
              .join(" ")
          : "There were no semantic matches recorded for the last routed command.";
      const pendingDetail = deps.pendingClarification
        ? ` Current pending clarification: ${deps.pendingClarification.prompt}`
        : "";

      deps.setCommandResult({
        title: "Why JARVIS chose that",
        detail: `Last route: ${routeLabel}. ${matchDetail}${pendingDetail}`,
        routeLabel,
      });
      deps.setStatusMessage("JARVIS explained the last routing decision.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn(
        "jarvis",
        deps.lastSemanticIntentMatches[0]
          ? `I matched mostly on ${deps.lastSemanticIntentMatches[0].label} at ${Math.round(deps.lastSemanticIntentMatches[0].score * 100)} percent confidence.`
          : "I do not have a semantic match recorded for the last command.",
      );
      deps.speakIfEnabled(
        deps.lastSemanticIntentMatches[0]
          ? `I matched mostly on ${deps.lastSemanticIntentMatches[0].label}.`
          : "I do not have a semantic match recorded for the last command.",
      );
      return { status: "completed" };
    }

    const semanticTestPhrase = J.parseSemanticIntentTestCommand(trimmedInput);
    if (semanticTestPhrase) {
      const semanticTestEmbedding = await deps.buildSemanticEmbeddingWithFallback(semanticTestPhrase);
      const semanticIntentRanks = await J.rankSemanticIntentCandidates(
        semanticTestPhrase,
        J.buildSemanticIntentCandidates(
          semanticTestPhrase,
          deps.browserAliases,
          deps.learnedIntentMappings,
          deps.savedWorkflows,
          deps.userPreferenceMemory,
          deps.activeConversationContext,
        ),
        semanticTestEmbedding.embedding,
        deps.buildCachedSemanticIntentEmbedding as unknown as (
          text: string,
        ) => Promise<{ embedding: number[]; backend: J.EmbeddingBackend }>,
        deps.semanticIntentFeedback,
      );
      const matches = semanticIntentRanks.slice(0, 5).map((rank) => ({
        id: rank.candidate.id,
        label: rank.candidate.label,
        source: rank.candidate.source,
        score: rank.score,
        confidence: rank.confidence,
        matchedExample: rank.matchedExample,
      }));
      deps.setLastSemanticIntentMatches(matches);
      deps.setCommandResult({
        title: "Semantic intent test",
        detail:
          matches.length > 0
            ? matches
                .map(
                  (match, index) =>
                    `${index + 1}. ${match.label} (${Math.round(match.score * 100)}%, ${match.source}, matched "${match.matchedExample}")`,
                )
                .join(" ")
            : `No semantic candidate reached the current confidence threshold for "${semanticTestPhrase}".`,
        routeLabel: "Semantic test only",
      });
      deps.setStatusMessage("Semantic intent test finished without executing an action.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn(
        "jarvis",
        matches[0]
          ? `Test only. The top match was ${matches[0].label} at ${Math.round(matches[0].score * 100)} percent.`
          : "Test only. I did not find a strong semantic match.",
        "Semantic test only",
      );
      deps.speakIfEnabled(
        matches[0]
          ? `Test only. The top match was ${matches[0].label}.`
          : "Test only. I did not find a strong semantic match.",
      );
      return { status: "completed" };
    }

    const sameTopicIntent = J.resolveSameTopicFollowUpIntent(
      trimmedInput,
      deps.lastConversationTopic,
      deps.activeConversationContext,
    );
    if (sameTopicIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      deps.currentRouteLabelRef.current = "Session topic memory";
      const completed = await executeIntent(sameTopicIntent);
      if (completed) {
        await deps.rememberSuccessfulPhrase(trimmedInput, sameTopicIntent);
        await deps.rememberSemanticConversationTurn(trimmedInput, sameTopicIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(sameTopicIntent)) {
        deps.openFollowUpWindow("reply");
      }
      deps.currentRouteLabelRef.current = undefined;
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const activeAppContextIntent = J.resolveActiveAppContextFollowUpIntent(
      trimmedInput,
      deps.activeConversationContext,
      deps.lastConversationTopic,
      deps.userPreferenceMemory.musicProvider,
    );
    if (activeAppContextIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      deps.currentRouteLabelRef.current = "Active context memory";
      const completed = await executeIntent(activeAppContextIntent);
      if (completed) {
        await deps.rememberSuccessfulPhrase(trimmedInput, activeAppContextIntent);
        await deps.rememberSemanticConversationTurn(trimmedInput, activeAppContextIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(activeAppContextIntent)) {
        deps.openFollowUpWindow("reply");
      }
      deps.currentRouteLabelRef.current = undefined;
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const naturalQueryEmbedding = await deps.buildSemanticEmbeddingWithFallback(trimmedInput);
    const naturalConversationResolution = J.resolveNaturalConversationFollowUp(
      trimmedInput,
      deps.activeConversationContext,
      deps.semanticConversationMemory,
      naturalQueryEmbedding.embedding,
    );
    if (naturalConversationResolution) {
      if (naturalConversationResolution.kind === "intent") {
        const completed = await executeIntent(naturalConversationResolution.intent);
        if (completed) {
          await deps.rememberSemanticConversationTurn(trimmedInput, naturalConversationResolution.intent);
        }
        return completed ? { status: "completed" } : { status: "failed" };
      }

      deps.setCommandResult({
        title: naturalConversationResolution.title,
        detail: naturalConversationResolution.detail,
      });
      deps.setStatusMessage("Conversation context answered from semantic memory.");
      deps.setVoiceSessionPhase("ready");
      deps.appendConversationTurn("jarvis", naturalConversationResolution.spoken);
      deps.speakIfEnabled(naturalConversationResolution.spoken);
      deps.openFollowUpWindow("reply");
      await deps.rememberSemanticConversationTurn(trimmedInput, null);
      return { status: "completed" };
    }

    if (deps.proactiveCrossSuggestion) {
      const normalizedReply = J.normalizeControlCommand(trimmedInput);
      if (["yes", "yeah", "yep", "sure", "okay", "ok", "do it", "do that"].includes(normalizedReply)) {
        const suggestion = deps.proactiveCrossSuggestion;
        deps.setProactiveCrossSuggestion(null);
        await handleApplyCrossFeatureSuggestion(suggestion);
        return { status: "completed" };
      }

      if (["no", "nope", "nah", "not now", "skip that", "don't do that", "do not do that"].includes(normalizedReply)) {
        deps.setProactiveCrossSuggestion(null);
        deps.setCommandResult({
          title: "Skipped suggested next step",
          detail: "Okay. I left that cross-feature follow-up alone.",
        });
        deps.setStatusMessage("Skipped the proactive cross-feature suggestion.");
        deps.setVoiceSessionPhase("ready");
        deps.appendConversationTurn("jarvis", "Okay, I won't do that right now.");
        deps.speakIfEnabled("Okay, I won't do that right now.");
        return { status: "completed" };
      }
    }

    if (deps.pendingWorkflowExecution) {
      return deps.continuePendingWorkflowExecution(deps.pendingWorkflowExecution, trimmedInput);
    }

    if (deps.pendingClarification) {
      const correctionInstruction = J.parseCorrectionInstruction(trimmedInput);
      if (correctionInstruction && deps.pendingClarification.originalPhrase) {
        deps.rememberRejectedPendingSemanticClarification(deps.pendingClarification);
        const originalPhrase = deps.pendingClarification.originalPhrase;
        deps.setTeachingTargetPhrase(null);
        deps.setPendingClarification(null);

        if (correctionInstruction.kind === "correct_workflow") {
          const workflow = deps.teachJarvisWorkflow(originalPhrase, correctionInstruction.steps);
          deps.setCommandResult({
            title: "Correction learned",
            detail: `Got it. I weakened the wrong guess and learned that "${originalPhrase}" runs ${workflow.steps.length} steps: ${workflow.steps.join(" -> ")}.`,
          });
          deps.setStatusMessage("JARVIS learned your correction as a workflow.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `Got it. I'll remember that ${originalPhrase} runs that workflow.`,
          );
          deps.speakIfEnabled(`Got it. I'll remember that ${originalPhrase} runs that workflow.`);
          return { status: "completed" };
        }

        try {
          const taught = await deps.teachJarvisMeaning(originalPhrase, correctionInstruction.meaning);
          deps.setCommandResult({
            title: "Correction learned",
            detail: `Got it. I weakened the wrong guess and learned that "${originalPhrase}" means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          });
          deps.setStatusMessage("JARVIS learned your correction.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `Got it. I'll remember that ${originalPhrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          );
          deps.speakIfEnabled(
            `Got it. I'll remember that ${originalPhrase} means ${J.describeCommandIntent(taught.resolvedIntent)}.`,
          );
          const completed = await executeIntent(taught.resolvedIntent);
          if (completed) {
            await deps.rememberSemanticConversationTurn(originalPhrase, taught.resolvedIntent);
          }
          return completed ? { status: "completed" } : { status: "failed" };
        } catch (error) {
          deps.setTeachingTargetPhrase(originalPhrase);
          deps.setCommandResult({
            title: "Correction needs a clearer action",
            detail: J.getErrorDetail(
              error,
              `I could not turn that correction into a reliable action. Try "when I say ${originalPhrase}, I mean play blinding lights on spotify".`,
            ),
          });
          deps.setStatusMessage("JARVIS could not learn that correction yet.");
          deps.setVoiceSessionPhase("ready");
          deps.appendConversationTurn(
            "jarvis",
            `I understand you are correcting me, but I need the action to be a little clearer.`,
          );
          deps.speakIfEnabled("I understand you are correcting me, but I need the action to be a little clearer.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.suggestedWorkflow) {
        const normalizedReply = J.normalizeControlCommand(trimmedInput);
        if (["yes", "yeah", "yep", "sure", "okay", "ok", "do that", "run it"].includes(normalizedReply)) {
          const triggerPhrase = deps.pendingClarification.suggestedWorkflow.triggerPhrase;
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? triggerPhrase,
            deps.pendingClarification.suggestedWorkflow.candidateId,
            deps.pendingClarification.suggestedWorkflow.candidateLabel,
            true,
          );
          deps.setPendingClarification(null);
          return runCommandAgain(triggerPhrase, {
            appendUserTurn: false,
            allowChaining: false,
          });
        }

        if (["no", "nope", "nah", "not that", "don't run that", "do not run that"].includes(normalizedReply)) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? deps.pendingClarification.suggestedWorkflow.triggerPhrase,
            deps.pendingClarification.suggestedWorkflow.candidateId,
            deps.pendingClarification.suggestedWorkflow.candidateLabel,
            false,
          );
          deps.setPendingClarification(null);
          deps.setCommandResult({
            title: "Workflow suggestion dismissed",
            detail: "Okay. I will not run that workflow for this phrase.",
          });
          deps.setStatusMessage("JARVIS skipped that semantic workflow suggestion.");
          deps.appendConversationTurn("jarvis", "Okay. I won't run that workflow.");
          deps.speakIfEnabled("Okay. I won't run that workflow.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.suggestedLearning) {
        const normalizedReply = J.normalizeControlCommand(trimmedInput);
        if (["yes", "yeah", "yep", "sure", "okay", "ok", "do that"].includes(normalizedReply)) {
          deps.setPendingClarification(null);
          await deps.rememberSuccessfulPhrase(
            deps.pendingClarification.suggestedLearning.originalPhrase,
            deps.pendingClarification.suggestedLearning.intent,
          );
          const completed = await executeIntent(deps.pendingClarification.suggestedLearning.intent);
          if (completed && deps.shouldKeepFollowUpWindowOpen(deps.pendingClarification.suggestedLearning.intent)) {
            deps.openFollowUpWindow("reply");
          }
          return completed ? { status: "completed" } : { status: "failed" };
        }

        if (["no", "nope", "nah", "not that", "don't learn that", "do not learn that"].includes(normalizedReply)) {
          deps.setPendingClarification(null);
          deps.setCommandResult({
            title: "Learning suggestion dismissed",
            detail: "Okay. I will not learn that phrase mapping right now.",
          });
          deps.setStatusMessage("JARVIS skipped that language-learning suggestion.");
          deps.appendConversationTurn("jarvis", "Okay. I won't learn that phrase mapping yet.");
          deps.speakIfEnabled("Okay. I won't learn that phrase mapping yet.");
          return { status: "clarification" };
        }
      }

      if (deps.pendingClarification.choices.length === 0) {
        deps.setCommandResult({
          title: "Still learning the meaning",
          detail: deps.pendingClarification.suggestedLearning
            ? `Say yes to learn that mapping, no to skip it, or teach me with "that means ...".`
            : deps.pendingClarification.prompt,
        });
        deps.appendConversationTurn(
          "jarvis",
          deps.pendingClarification.suggestedLearning
            ? `Say yes, no, or teach me what it means with "that means ...".`
            : J.buildClarificationReply(deps.pendingClarification.prompt),
        );
        deps.speakIfEnabled(
          deps.pendingClarification.suggestedLearning
            ? `Say yes, no, or teach me what it means.`
            : J.buildClarificationReply(deps.pendingClarification.prompt),
        );
        deps.openFollowUpWindow("clarification");
        return { status: "clarification" };
      }

      if (["no", "nope", "nah", "not that", "skip it", "don't do that", "do not do that"].includes(J.normalizeControlCommand(trimmedInput))) {
        if (deps.pendingClarification.suggestedSemanticIntent) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? deps.pendingClarification.prompt,
            deps.pendingClarification.suggestedSemanticIntent.candidateId,
            deps.pendingClarification.suggestedSemanticIntent.candidateLabel,
            false,
          );
        }
        deps.setPendingClarification(null);
        deps.setCommandResult({
          title: "Clarification skipped",
          detail: `Okay. I will not run that guess. You can teach me with "when I say ${deps.pendingClarification.originalPhrase ?? "that"}, I mean ...".`,
        });
        deps.setStatusMessage("JARVIS skipped the uncertain semantic match.");
        deps.appendConversationTurn("jarvis", "Okay. I won't run that guess.");
        deps.speakIfEnabled("Okay. I won't run that guess.");
        return { status: "clarification" };
      }

      const clarifiedIntent = J.resolveClarificationReply(trimmedInput, deps.pendingClarification);
      if (clarifiedIntent) {
        if (deps.pendingClarification.suggestedSemanticIntent) {
          deps.rememberSemanticIntentFeedback(
            deps.pendingClarification.originalPhrase ?? trimmedInput,
            deps.pendingClarification.suggestedSemanticIntent.candidateId,
            deps.pendingClarification.suggestedSemanticIntent.candidateLabel,
            true,
          );
        }
        deps.setPendingClarification(null);
        const completed = await executeIntent(clarifiedIntent);
        if (completed && deps.pendingClarification.originalPhrase) {
          await deps.rememberSuccessfulPhrase(deps.pendingClarification.originalPhrase, clarifiedIntent);
        }
        if (completed && deps.shouldKeepFollowUpWindowOpen(clarifiedIntent)) {
          deps.openFollowUpWindow("reply");
        }
        return completed ? { status: "completed" } : { status: "failed" };
      }

      deps.setCommandResult({
        title: "Still need clarification",
        detail: deps.pendingClarification.prompt,
      });
      deps.appendConversationTurn("jarvis", J.buildClarificationReply(deps.pendingClarification.prompt));
      deps.speakIfEnabled(J.buildClarificationReply(deps.pendingClarification.prompt));
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const savedWorkflowInvocation = J.resolveSavedWorkflowInvocation(trimmedInput, deps.savedWorkflows);
    if (savedWorkflowInvocation) {
      const { workflow: savedWorkflow, inputText } = savedWorkflowInvocation;
      deps.setStatusMessage(`Running saved workflow ${savedWorkflow.name}.`);
      for (let index = 0; index < savedWorkflow.steps.length; index += 1) {
        const rawStep = savedWorkflow.steps[index];
        const resolvedStep = J.resolveWorkflowConditionalStep(
          rawStep,
          deps.activeConversationContext,
          deps.recentEmails,
          deps.recentFiles,
          deps.recentNotes,
          deps.plannerTasks,
        );
        if (resolvedStep.action === "skip") {
          continue;
        }
        if (resolvedStep.action === "stop") {
          deps.setCommandResult({
            title: "Workflow stopped by condition",
            detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
          });
          deps.appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
          deps.speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
          return { status: "completed" };
        }
        const renderedStep = J.renderWorkflowStep(
          resolvedStep.step,
          deps.activeConversationContext,
          inputText,
        );
        if (renderedStep.missingPlaceholder) {
          deps.setPendingWorkflowExecution({
            workflowId: savedWorkflow.id,
            workflowName: savedWorkflow.name,
            inputText,
            currentStepIndex: index,
            rawSteps: savedWorkflow.steps,
            missingPlaceholder: renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
          });
          deps.setCommandResult({
            title: "Workflow needs more context",
            detail:
              renderedStep.missingPlaceholder === "deps.input"
                ? `The workflow "${savedWorkflow.name}" needs extra text after its trigger phrase.`
                : `The workflow "${savedWorkflow.name}" needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
          });
          deps.appendConversationTurn(
            "jarvis",
            renderedStep.missingPlaceholder === "deps.input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : `That workflow needs the right current context before I can run it.`,
          );
          deps.speakIfEnabled(
            renderedStep.missingPlaceholder === "deps.input"
              ? `That workflow needs a little more text after ${savedWorkflow.triggerPhrase}.`
              : "That workflow needs the right current context before I can run it.",
          );
          return { status: "clarification" };
        }

        const outcome = await runCommandAgain(renderedStep.step, {
          appendUserTurn: false,
          allowChaining: false,
        });
        if (outcome.status !== "completed") {
          deps.setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
          return outcome;
        }
      }

      deps.setCommandResult({
        title: "Workflow completed",
        detail: `Finished saved workflow "${savedWorkflow.name}".`,
      });
      deps.appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
      deps.speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
      return { status: "completed" };
    }

    if (allowChaining) {
      const workflowSteps = J.splitWorkflowCommand(trimmedInput);
      if (workflowSteps) {
        deps.setStatusMessage(`Running a ${workflowSteps.length}-step workflow through JARVIS.`);
        let completedSteps = 0;
        for (const step of workflowSteps) {
          const outcome = await runCommandAgain(step, {
            appendUserTurn: false,
            allowChaining: false,
          });
          if (outcome.status !== "completed") {
            deps.setStatusMessage(
              completedSteps > 0
                ? `Workflow paused after ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`
                : "Workflow paused before completion.",
            );
            return outcome;
          }
          completedSteps += 1;
        }

        deps.setStatusMessage(
          `Workflow complete. Finished ${completedSteps} step${completedSteps === 1 ? "" : "s"}.`,
        );
        deps.rememberWorkflowSequence(workflowSteps, trimmedInput);
        return { status: "completed" };
      }
    }

    const learnedIntent = J.resolveLearnedIntent(trimmedInput, deps.learnedIntentMappings);
    if (learnedIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(learnedIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, learnedIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(learnedIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const contextualIntent = J.resolveContextualFollowUpIntent(
      trimmedInput,
      deps.activeConversationContext,
    );
    if (contextualIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(contextualIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, contextualIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(contextualIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const ordinalIntent = J.resolveOrdinalFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (ordinalIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(ordinalIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, ordinalIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(ordinalIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const referenceIntent = J.resolveReferenceFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.activeConversationContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (referenceIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(referenceIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, referenceIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(referenceIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    const batchReferenceIntent = J.resolveBatchReferenceFollowUpIntent(
      trimmedInput,
      deps.presentedCollectionContext,
      deps.activeConversationContext,
      deps.recentEmails,
      deps.recentFiles,
      deps.recentNotes,
      deps.plannerTasks,
    );
    if (batchReferenceIntent) {
      deps.setMissingSkillRequest(null);
      deps.setMissingSkillPlan(null);
      const completed = await executeIntent(batchReferenceIntent);
      if (completed) {
        deps.setTeachingTargetPhrase(null);
        await deps.rememberSuccessfulPhrase(trimmedInput, batchReferenceIntent);
      }
      if (completed && deps.shouldKeepFollowUpWindowOpen(batchReferenceIntent)) {
        deps.openFollowUpWindow("reply");
      }
      return completed ? { status: "completed" } : { status: "failed" };
    }

    if (!J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases)) {
      const semanticIntentRanks = await J.rankSemanticIntentCandidates(
        trimmedInput,
        J.buildSemanticIntentCandidates(
          trimmedInput,
          deps.browserAliases,
          deps.learnedIntentMappings,
          deps.savedWorkflows,
          deps.userPreferenceMemory,
          deps.activeConversationContext,
        ),
        naturalQueryEmbedding.embedding,
        deps.buildCachedSemanticIntentEmbedding as unknown as (
          text: string,
        ) => Promise<{ embedding: number[]; backend: J.EmbeddingBackend }>,
        deps.semanticIntentFeedback,
      );
      deps.setLastSemanticIntentMatches(
        semanticIntentRanks.slice(0, 3).map((rank) => ({
          id: rank.candidate.id,
          label: rank.candidate.label,
          source: rank.candidate.source,
          score: rank.score,
          confidence: rank.confidence,
          matchedExample: rank.matchedExample,
        })),
      );
      const semanticIntentRank = semanticIntentRanks[0] ?? null;

      if (semanticIntentRank) {
        const routeLabel = `Semantic foundation -> ${semanticIntentRank.candidate.source}`;
        if (semanticIntentRank.candidate.source === "workflow") {
          const workflow = semanticIntentRank.candidate.workflow;
          if (semanticIntentRank.confidence === "high") {
            deps.rememberSemanticIntentFeedback(
              trimmedInput,
              semanticIntentRank.candidate.id,
              semanticIntentRank.candidate.label,
              true,
            );
            deps.setStatusMessage(`JARVIS matched the workflow ${workflow.name} with semantic memory.`);
            deps.appendConversationTurn(
              "jarvis",
              `That sounds like your ${workflow.name} workflow. I'll run it now.`,
              routeLabel,
            );
            return runCommandAgain(workflow.triggerPhrase, {
              appendUserTurn: false,
              allowChaining: false,
            });
          }

          deps.setTeachingTargetPhrase(trimmedInput);
          deps.setPendingClarification({
            prompt: `This sounds close to your workflow "${workflow.name}". Should I run it?`,
            choices: [],
            originalPhrase: trimmedInput,
            confidence: semanticIntentRank.confidence,
            confidenceScore: semanticIntentRank.score,
            suggestedWorkflow: {
              workflowId: workflow.id,
              workflowName: workflow.name,
              triggerPhrase: workflow.triggerPhrase,
              candidateId: semanticIntentRank.candidate.id,
              candidateLabel: semanticIntentRank.candidate.label,
              confidence: semanticIntentRank.confidence,
              confidenceScore: semanticIntentRank.score,
            },
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("JARVIS found a semantic workflow match and wants to confirm it.");
          deps.setCommandResult({
            title: "Semantic workflow match",
            detail: `I think "${trimmedInput}" means "${workflow.name}" (${Math.round(semanticIntentRank.score * 100)}%). Say yes to run it, no to skip, or teach me a better meaning.`,
            routeLabel,
          });
          deps.appendConversationTurn(
            "jarvis",
            `That sounds close to your workflow ${workflow.name}. Should I run it?`,
            routeLabel,
          );
          deps.speakIfEnabled(`That sounds close to your workflow ${workflow.name}. Should I run it?`);
          deps.openFollowUpWindow("clarification");
          return { status: "clarification" };
        }

        const resolvedIntent = semanticIntentRank.candidate.resolve(trimmedInput);
        if (resolvedIntent) {
          const needsConfirmation = J.requiresSemanticConfirmation(resolvedIntent);
          if (semanticIntentRank.confidence === "high" && !needsConfirmation) {
            deps.setMissingSkillRequest(null);
            deps.setMissingSkillPlan(null);
            deps.currentRouteLabelRef.current = routeLabel;
            const completed = await executeIntent(resolvedIntent);
            if (completed) {
              deps.setTeachingTargetPhrase(null);
              deps.rememberSemanticIntentFeedback(
                trimmedInput,
                semanticIntentRank.candidate.id,
                semanticIntentRank.candidate.label,
                true,
              );
              await deps.rememberSuccessfulPhrase(trimmedInput, resolvedIntent);
              await deps.rememberSemanticConversationTurn(trimmedInput, resolvedIntent);
            }
            if (completed && deps.shouldKeepFollowUpWindowOpen(resolvedIntent)) {
              deps.openFollowUpWindow("reply");
            }
            deps.currentRouteLabelRef.current = undefined;
            return completed ? { status: "completed" } : { status: "failed" };
          }

          deps.setTeachingTargetPhrase(trimmedInput);
          deps.setPendingClarification({
            prompt: needsConfirmation
              ? `This can change data or run a sensitive action. Did you mean ${J.describeCommandIntent(resolvedIntent)}?`
              : `Did you mean ${J.describeCommandIntent(resolvedIntent)}?`,
            choices: [
              {
                label: J.describeCommandIntent(resolvedIntent),
                intent: resolvedIntent,
              },
            ],
            originalPhrase: trimmedInput,
            confidence: semanticIntentRank.confidence,
            confidenceScore: semanticIntentRank.score,
            suggestedSemanticIntent: {
              candidateId: semanticIntentRank.candidate.id,
              candidateLabel: semanticIntentRank.candidate.label,
              confidence: semanticIntentRank.confidence,
              confidenceScore: semanticIntentRank.score,
            },
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("JARVIS found a semantic intent match and wants to confirm it.");
          deps.setCommandResult({
            title: "Semantic intent match",
            detail: `${needsConfirmation ? "Safety check: this action needs confirmation. " : ""}I matched this to "${semanticIntentRank.candidate.label}" from the pretrained foundation (${Math.round(semanticIntentRank.score * 100)}%). Say yes to run it, no to skip, or teach me a better meaning.`,
            routeLabel,
          });
          deps.appendConversationTurn(
            "jarvis",
            `I think you mean ${J.describeCommandIntent(resolvedIntent)}. Should I do that?`,
            routeLabel,
          );
          deps.speakIfEnabled(`I think you mean ${J.describeCommandIntent(resolvedIntent)}. Should I do that?`);
          deps.openFollowUpWindow("clarification");
          return { status: "clarification" };
        }
      }
    }

    const learnedSuggestion = J.findLearnedIntentSuggestion(trimmedInput, deps.learnedIntentMappings);
    if (learnedSuggestion) {
      deps.setTeachingTargetPhrase(trimmedInput);
      const family = J.findLearnedIntentFamilySummary(
        learnedSuggestion.intent,
        deps.learnedIntentMappings,
      );
      const confidence = J.getIntentConfidenceFromScore(learnedSuggestion.score);
      const familyLabel = family?.label ?? J.describeCommandIntent(learnedSuggestion.intent);
      const familyPhraseCount = family?.phraseCount ?? 1;
      deps.setPendingClarification({
        prompt: `This sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat "${trimmedInput}" the same way from now on?`,
        choices: [],
        originalPhrase: trimmedInput,
        confidence,
        confidenceScore: learnedSuggestion.score,
        suggestedLearning: {
          originalPhrase: trimmedInput,
          sourcePhrase: learnedSuggestion.record.phrase,
          intent: learnedSuggestion.intent,
          confidence,
          confidenceScore: learnedSuggestion.score,
          familyLabel,
          familyPhraseCount,
        },
      });
      deps.setVoiceSessionPhase("ready");
      deps.setStatusMessage(
        `JARVIS found a ${J.formatIntentConfidenceLabel(confidence)} learned phrase match and wants to confirm it.`,
      );
      deps.setCommandResult({
        title: "Language learning suggestion",
        detail: `I think "${trimmedInput}" belongs to your "${familyLabel}" phrase family. Match confidence: ${Math.round(learnedSuggestion.score * 100)}%. Say yes to learn and reuse it, or no to skip it.`,
      });
      deps.appendConversationTurn(
        "jarvis",
        `That sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase "${learnedSuggestion.record.phrase}". Should I treat it the same way from now on?`,
      );
      deps.speakIfEnabled(
        `That sounds ${J.formatIntentConfidenceLabel(confidence)} close to your learned phrase ${learnedSuggestion.record.phrase}. Should I treat it the same way from now on?`,
      );
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    const clarification = J.buildClarificationForCommand(trimmedInput, deps.browserAliases);
    if (clarification) {
      deps.setTeachingTargetPhrase(trimmedInput);
      deps.setPendingClarification({
        ...clarification,
        originalPhrase: trimmedInput,
      });
      deps.setVoiceSessionPhase("ready");
      deps.setStatusMessage(
        clarification.confidence
          ? `JARVIS needs a quick clarification because this is a ${J.formatIntentConfidenceLabel(clarification.confidence)} guess.`
          : "JARVIS needs a quick clarification.",
      );
      deps.setCommandResult({
        title: "Need clarification",
        detail: clarification.confidence
          ? `${clarification.prompt} Confidence: ${Math.round((clarification.confidenceScore ?? 0) * 100)}%.`
          : clarification.prompt,
      });
      deps.appendConversationTurn("jarvis", J.buildClarificationReply(clarification.prompt));
      deps.speakIfEnabled(J.buildClarificationReply(clarification.prompt));
      deps.openFollowUpWindow("clarification");
      return { status: "clarification" };
    }

    let intent: CommandIntent | null = null;
    let routeFallbackNote: string | null = null;
    let routeLabel = deps.conversationBackend === "auto" ? "Auto" : deps.conversationBackend === "ollama" ? "Ollama" : "Heuristics";

    const tryOllamaInterpretation = async () => {
      try {
        const interpretation = await interpretConversationWithOllama(
          trimmedInput,
          deps.assistantName,
        );
        const mappedResult = J.mapOllamaInterpretationToResult(interpretation);

        if (mappedResult.kind === "clarification") {
          routeLabel = deps.conversationBackend === "auto" ? "Auto -> Ollama" : "Ollama";
          deps.setPendingClarification({
            prompt: mappedResult.prompt,
            choices: [],
            originalPhrase: trimmedInput,
          });
          deps.setVoiceSessionPhase("ready");
          deps.setStatusMessage("Ollama asked for a quick clarification.");
          deps.setCommandResult({
            title: "Need clarification",
            detail: mappedResult.prompt,
            routeLabel,
          });
          deps.appendConversationTurn("jarvis", J.buildClarificationReply(mappedResult.prompt), routeLabel);
          deps.speakIfEnabled(J.buildClarificationReply(mappedResult.prompt));
          deps.openFollowUpWindow("clarification");
          return { resolved: true as const, outcome: { status: "clarification" as const } };
        }

        if (mappedResult.kind === "intent") {
          if (
            mappedResult.intent.kind === "google_search" &&
            !J.hasExplicitSearchLanguage(trimmedInput)
          ) {
            intent = null;
          } else if (
            mappedResult.intent.kind === "open_url" &&
            !J.hasExplicitOpenLanguage(trimmedInput)
          ) {
            intent = null;
          } else {
            intent = mappedResult.intent;
            routeLabel = deps.conversationBackend === "auto" ? "Auto -> Ollama" : "Ollama";
          }
        }
      } catch (error) {
        routeFallbackNote = J.getErrorDetail(
          error,
          "Ollama could not interpret that request, so JARVIS fell back to heuristics.",
        );
        deps.setStatusMessage(routeFallbackNote);
      }

      return { resolved: false as const };
    };

    if (deps.conversationBackend === "ollama") {
      const result = await tryOllamaInterpretation();
      if (result.resolved) {
        return result.outcome;
      }
    } else if (deps.conversationBackend === "auto") {
      if (J.shouldUseOllamaFirstInAutoMode(trimmedInput)) {
        const result = await tryOllamaInterpretation();
        if (result.resolved) {
          return result.outcome;
        }
        if (!intent) {
          intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
          if (intent) {
            routeLabel = "Auto -> Heuristics";
          }
        }
      } else {
        intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
        if (intent) {
          routeLabel = "Auto -> Heuristics";
        }
        if (!intent) {
          const result = await tryOllamaInterpretation();
          if (result.resolved) {
            return result.outcome;
          }
        }
      }
    }

    if (!intent) {
      intent = J.parseConversationalCommandIntent(trimmedInput, deps.browserAliases);
      if (intent && deps.conversationBackend === "heuristics") {
        routeLabel = "Heuristics";
      }
    }

    if (!intent) {
      deps.setTeachingTargetPhrase(trimmedInput);
      deps.setMissingSkillRequest(trimmedInput);
      deps.setMissingSkillPlan(null);
      deps.setVoiceSessionPhase("ready");
      deps.setCommandResult({
        title: "Conversation understood, skill missing",
        detail:
          `I understood that as a request, but I do not have the right skill wired yet. You can also teach me directly by saying "when I say ${trimmedInput}, I mean ...".`,
        routeLabel,
      });
      if (routeFallbackNote) {
        deps.setCommandResult((current) =>
          current
            ? { ...current, detail: `${current.detail} ${routeFallbackNote}` }
            : current,
        );
      }
      deps.appendConversationTurn("jarvis", J.buildMissingSkillReply(), routeLabel);
      deps.speakIfEnabled("I get what you're asking, but that skill is not wired yet.");
      deps.openFollowUpWindow("reply");

      if (
        deps.skillAutopilotAvailable &&
        deps.autonomousSkillBuildingEnabled &&
        (deps.conversationBackend === "ollama" || deps.conversationBackend === "auto")
      ) {
        void deps.handleAskAdvancedAssistant(trimmedInput);
      }
      return { status: "missing_skill" };
    }

    deps.setMissingSkillRequest(null);
    deps.setMissingSkillPlan(null);
    deps.currentRouteLabelRef.current = routeLabel;
    const completed = await executeIntent(intent);
    if (routeFallbackNote) {
      const fallbackNote = routeFallbackNote;
      deps.setCommandResult((current) =>
        current
          ? { ...current, detail: `${current.detail} ${fallbackNote}`, routeLabel }
          : { title: "Routing fallback", detail: fallbackNote, routeLabel },
      );
      deps.setStatusMessage(fallbackNote);
    } else {
      deps.setCommandResult((current) => (current ? { ...current, routeLabel } : current));
    }
    if (completed) {
      deps.setTeachingTargetPhrase(null);
      await deps.rememberSuccessfulPhrase(trimmedInput, intent);
      await deps.rememberSemanticConversationTurn(trimmedInput, intent);
    }
    if (completed && deps.shouldKeepFollowUpWindowOpen(intent)) {
      deps.openFollowUpWindow("reply");
    }
    deps.currentRouteLabelRef.current = undefined;
    return completed ? { status: "completed" } : { status: "failed" };
}
