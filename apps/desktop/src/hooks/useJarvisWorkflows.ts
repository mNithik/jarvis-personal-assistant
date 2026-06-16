import { useEffect, useRef, useState, type MutableRefObject } from "react";

import type { ActiveConversationContext, PlannerTaskRecord } from "../features/command/jarvisCommandTypes";
import {
  DISMISSED_WORKFLOWS_STORAGE_KEY,
  SAVED_WORKFLOWS_STORAGE_KEY,
  WORKFLOW_COUNTS_STORAGE_KEY,
  buildWorkflowSignature,
  generateWorkflowName,
  generateWorkflowTriggerPhrase,
  getErrorDetail,
  renderWorkflowStep,
  resolveWorkflowConditionalStep,
} from "../features/command/parsers/explicitIntent";
import { normalizeControlCommand } from "../features/semantic/intentRanking";
import type { EmailRecord, FileRecord, NoteRecord } from "../types/jarvis";
import type {
  PendingWorkflowExecution,
  RunCommandOutcome,
  SavedWorkflowRecord,
  WorkflowSuggestionRecord,
  WorkflowTemplateRecord,
} from "../features/command/jarvisCommandTypes";

type CommandResult = { title: string; detail: string };

type RunCommandOptions = {
  appendUserTurn?: boolean;
  allowChaining?: boolean;
};

type UseJarvisWorkflowsOptions = {
  activeConversationContext: ActiveConversationContext | null;
  recentEmails: EmailRecord[];
  recentFiles: FileRecord[];
  recentNotes: NoteRecord[];
  plannerTasks: PlannerTaskRecord[];
  appendConversationTurnRef: MutableRefObject<(role: "user" | "jarvis", text: string) => void>;
  speakIfEnabledRef: MutableRefObject<(text: string) => void>;
  runCommandRef: MutableRefObject<
    (command: string, options?: RunCommandOptions) => Promise<RunCommandOutcome>
  >;
  setCommandResult: (result: CommandResult | null) => void;
  setStatusMessage: (message: string) => void;
};

/** Wave 2 peel: saved workflow state, persistence, and handlers from JarvisAppRoot.logic */
export function useJarvisWorkflows({
  activeConversationContext,
  appendConversationTurnRef,
  plannerTasks,
  recentEmails,
  recentFiles,
  recentNotes,
  runCommandRef,
  setCommandResult,
  setStatusMessage,
  speakIfEnabledRef,
}: UseJarvisWorkflowsOptions) {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowRecord[]>([]);
  const [workflowSuggestion, setWorkflowSuggestion] = useState<WorkflowSuggestionRecord | null>(
    null,
  );
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [pendingWorkflowExecution, setPendingWorkflowExecution] =
    useState<PendingWorkflowExecution | null>(null);
  const [workflowImportText, setWorkflowImportText] = useState("");
  const [workflowRenameDrafts, setWorkflowRenameDrafts] = useState<Record<string, string>>({});

  const savedWorkflowsRef = useRef(savedWorkflows);
  savedWorkflowsRef.current = savedWorkflows;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_WORKFLOWS_STORAGE_KEY);
      if (saved) {
        setSavedWorkflows(JSON.parse(saved) as SavedWorkflowRecord[]);
      }
    } catch {
      setSavedWorkflows([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(savedWorkflows),
      );
    } catch {
      setStatusMessage("JARVIS could not persist saved workflows locally.");
    }
  }, [savedWorkflows, setStatusMessage]);

  function appendConversationTurn(role: "user" | "jarvis", text: string) {
    appendConversationTurnRef.current(role, text);
  }

  function speakIfEnabled(text: string) {
    speakIfEnabledRef.current(text);
  }

  function teachJarvisWorkflow(phrase: string, steps: string[]) {
    const triggerPhrase = phrase.trim();
    const normalizedTrigger = normalizeControlCommand(triggerPhrase);
    if (!normalizedTrigger || steps.length < 2) {
      throw new Error("A taught workflow needs a trigger phrase and at least two clear steps.");
    }

    const duplicate = savedWorkflowsRef.current.find(
      (workflow) => normalizeControlCommand(workflow.triggerPhrase) === normalizedTrigger,
    );
    const workflow: SavedWorkflowRecord = {
      id: duplicate?.id ?? `${Date.now()}`,
      name: duplicate?.name ?? generateWorkflowName(steps),
      triggerPhrase,
      steps,
      createdAt: duplicate?.createdAt ?? new Date().toISOString(),
      basedOnCount: duplicate?.basedOnCount ?? 1,
    };

    setSavedWorkflows((current) =>
      [workflow, ...current.filter((entry) => entry.id !== workflow.id)].slice(0, 20),
    );

    return workflow;
  }

  function getWorkflowCounts() {
    try {
      const raw = window.localStorage.getItem(WORKFLOW_COUNTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  function setWorkflowCounts(counts: Record<string, number>) {
    try {
      window.localStorage.setItem(WORKFLOW_COUNTS_STORAGE_KEY, JSON.stringify(counts));
    } catch {
      setStatusMessage("JARVIS could not persist workflow-learning counts.");
    }
  }

  function getDismissedWorkflowSignatures() {
    try {
      const raw = window.localStorage.getItem(DISMISSED_WORKFLOWS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  function setDismissedWorkflowSignatures(signatures: string[]) {
    try {
      window.localStorage.setItem(
        DISMISSED_WORKFLOWS_STORAGE_KEY,
        JSON.stringify(signatures),
      );
    } catch {
      setStatusMessage("JARVIS could not persist dismissed workflow suggestions.");
    }
  }

  function rememberWorkflowSequence(steps: string[], sampleCommand: string) {
    const signature = buildWorkflowSignature(steps);
    const savedTriggerSet = new Set(
      savedWorkflowsRef.current.map((workflow) =>
        normalizeControlCommand(workflow.triggerPhrase),
      ),
    );
    if (savedTriggerSet.has(normalizeControlCommand(sampleCommand))) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    if (dismissed.includes(signature)) {
      return;
    }

    if (
      savedWorkflowsRef.current.some(
        (workflow) => buildWorkflowSignature(workflow.steps) === signature,
      )
    ) {
      return;
    }

    const counts = getWorkflowCounts();
    const nextCount = (counts[signature] ?? 0) + 1;
    counts[signature] = nextCount;
    setWorkflowCounts(counts);

    if (nextCount < 2) {
      return;
    }

    const name = generateWorkflowName(steps);
    const triggerPhrase = generateWorkflowTriggerPhrase(name);
    setWorkflowSuggestion({
      signature,
      name,
      triggerPhrase,
      steps,
      basedOnCount: nextCount,
      sampleCommand,
    });
    setCommandResult({
      title: "Workflow learned from repetition",
      detail: `You've repeated this ${nextCount} times. I can save it as "${name}" and run it later with "${triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `You've repeated that workflow a few times. I can save it as ${name} and run it later if you want.`,
    );
  }

  function handleApproveWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}`,
      name: workflowSuggestion.name,
      triggerPhrase: workflowSuggestion.triggerPhrase,
      steps: workflowSuggestion.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: workflowSuggestion.basedOnCount,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 12));
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow saved",
      detail: `Saved "${workflow.name}". You can now say "${workflow.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Saved that workflow. You can now say ${workflow.triggerPhrase}.`,
    );
    speakIfEnabled(`Saved that workflow. You can now say ${workflow.triggerPhrase}.`);
  }

  function handleDismissWorkflowSuggestion() {
    if (!workflowSuggestion) {
      return;
    }

    const dismissed = getDismissedWorkflowSignatures();
    setDismissedWorkflowSignatures([...dismissed, workflowSuggestion.signature]);
    setWorkflowSuggestion(null);
    setCommandResult({
      title: "Workflow suggestion dismissed",
      detail: "Okay. I won't suggest saving that repeated workflow right now.",
    });
    appendConversationTurn(
      "jarvis",
      "Okay. I won't suggest saving that workflow right now.",
    );
    speakIfEnabled("Okay. I won't suggest saving that workflow right now.");
  }

  function handleWorkflowFieldChange(
    workflowId: string,
    field: "name" | "triggerPhrase",
    value: string,
  ) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, [field]: value } : workflow,
      ),
    );
  }

  function handleWorkflowStepChange(workflowId: string, stepIndex: number, value: string) {
    setSavedWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId
          ? {
              ...workflow,
              steps: workflow.steps.map((step, index) => (index === stepIndex ? value : step)),
            }
          : workflow,
      ),
    );
  }

  function handleSaveWorkflowEdits(workflowId: string) {
    const workflow = savedWorkflowsRef.current.find((entry) => entry.id === workflowId);
    if (!workflow) {
      return;
    }

    const cleanedName = workflow.name.trim();
    const cleanedTrigger = workflow.triggerPhrase.trim();
    const cleanedSteps = workflow.steps.map((step) => step.trim()).filter(Boolean);

    if (!cleanedName || !cleanedTrigger || cleanedSteps.length === 0) {
      setCommandResult({
        title: "Workflow edit incomplete",
        detail: "A saved workflow needs a name, a trigger phrase, and at least one step.",
      });
      speakIfEnabled("That workflow still needs a name, trigger, and at least one step.");
      return;
    }

    const normalizedTrigger = normalizeControlCommand(cleanedTrigger);
    const duplicate = savedWorkflowsRef.current.find(
      (entry) =>
        entry.id !== workflowId &&
        normalizeControlCommand(entry.triggerPhrase) === normalizedTrigger,
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `The trigger phrase "${cleanedTrigger}" is already used by ${duplicate.name}.`,
      });
      speakIfEnabled("That workflow trigger is already being used.");
      return;
    }

    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflowId
          ? {
              ...entry,
              name: cleanedName,
              triggerPhrase: cleanedTrigger,
              steps: cleanedSteps,
            }
          : entry,
      ),
    );
    setEditingWorkflowId(null);
    setCommandResult({
      title: "Workflow updated",
      detail: `Saved edits to ${cleanedName}. You can trigger it with "${cleanedTrigger}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Updated the workflow ${cleanedName}. You can trigger it with ${cleanedTrigger}.`,
    );
    speakIfEnabled(`Updated the workflow ${cleanedName}.`);
  }

  function handleAddWorkflowTemplate(template: WorkflowTemplateRecord) {
    const normalizedTrigger = normalizeControlCommand(template.triggerPhrase);
    const duplicate = savedWorkflowsRef.current.find(
      (workflow) =>
        normalizeControlCommand(workflow.triggerPhrase) === normalizedTrigger ||
        workflow.name.trim().toLowerCase() === template.name.trim().toLowerCase(),
    );

    if (duplicate) {
      setCommandResult({
        title: "Template already added",
        detail: `A saved workflow named ${duplicate.name} is already using that trigger or template shape.`,
      });
      speakIfEnabled("That workflow template is already in your library.");
      return;
    }

    const workflow: SavedWorkflowRecord = {
      id: `${Date.now()}-${template.id}`,
      name: template.name,
      triggerPhrase: template.triggerPhrase,
      steps: template.steps,
      createdAt: new Date().toISOString(),
      basedOnCount: 1,
    };
    setSavedWorkflows((current) => [workflow, ...current].slice(0, 20));
    setCommandResult({
      title: "Workflow template added",
      detail: `Added ${template.name}. You can trigger it with "${template.triggerPhrase}".`,
    });
    appendConversationTurn(
      "jarvis",
      `Added the workflow template ${template.name}. You can trigger it with ${template.triggerPhrase}.`,
    );
    speakIfEnabled(`Added the workflow template ${template.name}.`);
  }

  function handleExportWorkflows() {
    const exportPayload = JSON.stringify(savedWorkflowsRef.current, null, 2);
    setWorkflowImportText(exportPayload);
    setCommandResult({
      title: "Workflow export ready",
      detail: "Your saved workflows are now in the export box as JSON.",
    });
    appendConversationTurn(
      "jarvis",
      "I prepared your saved workflows for export in the JSON box.",
    );
    speakIfEnabled("I prepared your saved workflows for export.");
  }

  function handleImportWorkflows() {
    try {
      const parsed = JSON.parse(workflowImportText) as SavedWorkflowRecord[];
      if (!Array.isArray(parsed)) {
        throw new Error("Workflow import must be a JSON array.");
      }

      const sanitized = parsed
        .map((workflow, index) => ({
          id: workflow.id || `${Date.now()}-${index}`,
          name: workflow.name?.trim() || `Imported workflow ${index + 1}`,
          triggerPhrase: workflow.triggerPhrase?.trim() || `run imported workflow ${index + 1}`,
          steps: Array.isArray(workflow.steps)
            ? workflow.steps.map((step) => String(step).trim()).filter(Boolean)
            : [],
          createdAt: workflow.createdAt || new Date().toISOString(),
          basedOnCount:
            typeof workflow.basedOnCount === "number" && Number.isFinite(workflow.basedOnCount)
              ? workflow.basedOnCount
              : 1,
        }))
        .filter((workflow) => workflow.steps.length > 0);

      const deduped = new Map<string, SavedWorkflowRecord>();
      for (const workflow of sanitized) {
        deduped.set(normalizeControlCommand(workflow.triggerPhrase), workflow);
      }

      const importedWorkflows = Array.from(deduped.values());
      setSavedWorkflows(importedWorkflows.slice(0, 20));
      setEditingWorkflowId(null);
      setCommandResult({
        title: "Workflows imported",
        detail: `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      });
      appendConversationTurn(
        "jarvis",
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
      speakIfEnabled(
        `Imported ${importedWorkflows.length} saved workflow${importedWorkflows.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setCommandResult({
        title: "Workflow import failed",
        detail: getErrorDetail(error, "JARVIS could not read that workflow JSON."),
      });
      speakIfEnabled("I could not import that workflow JSON.");
    }
  }

  function handleDeleteWorkflow(workflow: SavedWorkflowRecord) {
    setSavedWorkflows((current) => current.filter((entry) => entry.id !== workflow.id));
    setWorkflowRenameDrafts((current) => {
      const next = { ...current };
      delete next[workflow.id];
      return next;
    });
    setCommandResult({
      title: "Training workflow deleted",
      detail: `Removed "${workflow.name}" from saved workflows.`,
    });
    setStatusMessage("Deleted saved workflow.");
  }

  function handleRenameWorkflow(workflow: SavedWorkflowRecord) {
    const nextTrigger = workflowRenameDrafts[workflow.id]?.trim();
    if (
      !nextTrigger ||
      normalizeControlCommand(nextTrigger) === normalizeControlCommand(workflow.triggerPhrase)
    ) {
      return;
    }

    const duplicate = savedWorkflowsRef.current.find(
      (entry) =>
        entry.id !== workflow.id &&
        normalizeControlCommand(entry.triggerPhrase) === normalizeControlCommand(nextTrigger),
    );
    if (duplicate) {
      setCommandResult({
        title: "Workflow trigger already used",
        detail: `"${nextTrigger}" is already used by ${duplicate.name}.`,
      });
      setStatusMessage("Workflow rename blocked by duplicate trigger.");
      return;
    }

    setSavedWorkflows((current) =>
      current.map((entry) =>
        entry.id === workflow.id ? { ...entry, triggerPhrase: nextTrigger } : entry,
      ),
    );
    setWorkflowRenameDrafts((current) => {
      const next = { ...current };
      delete next[workflow.id];
      return next;
    });
    setCommandResult({
      title: "Training workflow renamed",
      detail: `Updated "${workflow.name}" trigger to "${nextTrigger}".`,
    });
    setStatusMessage("Renamed saved workflow trigger.");
  }

  async function continuePendingWorkflowExecution(
    execution: PendingWorkflowExecution,
    providedValue: string,
  ) {
    const savedWorkflow = savedWorkflowsRef.current.find(
      (workflow) => workflow.id === execution.workflowId,
    );
    if (!savedWorkflow) {
      setPendingWorkflowExecution(null);
      setCommandResult({
        title: "Workflow no longer available",
        detail: "That saved workflow could not be found anymore.",
      });
      return { status: "failed" as const };
    }

    const resumedInputText =
      execution.missingPlaceholder === "input" ? providedValue.trim() : execution.inputText;
    setPendingWorkflowExecution(null);

    for (let index = execution.currentStepIndex; index < execution.rawSteps.length; index += 1) {
      const resolvedStep = resolveWorkflowConditionalStep(
        execution.rawSteps[index],
        activeConversationContext,
        recentEmails,
        recentFiles,
        recentNotes,
        plannerTasks,
      );

      if (resolvedStep.action === "skip") {
        continue;
      }

      if (resolvedStep.action === "stop") {
        setCommandResult({
          title: "Workflow stopped by condition",
          detail: `Stopped ${savedWorkflow.name} because one of its conditions chose a stop branch.`,
        });
        appendConversationTurn("jarvis", `Stopped the workflow ${savedWorkflow.name}.`);
        speakIfEnabled(`Stopped the workflow ${savedWorkflow.name}.`);
        return { status: "completed" as const };
      }

      const renderedStep = renderWorkflowStep(
        resolvedStep.step,
        activeConversationContext,
        resumedInputText,
      );

      if (renderedStep.missingPlaceholder) {
        setPendingWorkflowExecution({
          ...execution,
          inputText: resumedInputText,
          currentStepIndex: index,
          missingPlaceholder:
            renderedStep.missingPlaceholder as PendingWorkflowExecution["missingPlaceholder"],
        });
        setCommandResult({
          title: "Workflow needs more context",
          detail:
            renderedStep.missingPlaceholder === "input"
              ? `The workflow "${savedWorkflow.name}" still needs extra text after its trigger phrase.`
              : `The workflow "${savedWorkflow.name}" still needs a matching current context for {{${renderedStep.missingPlaceholder}}}.`,
        });
        appendConversationTurn(
          "jarvis",
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        speakIfEnabled(
          renderedStep.missingPlaceholder === "input"
            ? `I still need the text you want to use for ${savedWorkflow.name}.`
            : `I still need the right current context before I can continue ${savedWorkflow.name}.`,
        );
        return { status: "clarification" as const };
      }

      const outcome = await runCommandRef.current(renderedStep.step, {
        appendUserTurn: false,
        allowChaining: false,
      });
      if (outcome.status !== "completed") {
        setStatusMessage(`Saved workflow ${savedWorkflow.name} paused before completion.`);
        return outcome;
      }
    }

    setCommandResult({
      title: "Workflow completed",
      detail: `Finished saved workflow "${savedWorkflow.name}".`,
    });
    appendConversationTurn("jarvis", `Finished the workflow ${savedWorkflow.name}.`);
    speakIfEnabled(`Finished the workflow ${savedWorkflow.name}.`);
    return { status: "completed" as const };
  }

  return {
    continuePendingWorkflowExecution,
    editingWorkflowId,
    getDismissedWorkflowSignatures,
    getWorkflowCounts,
    handleAddWorkflowTemplate,
    handleApproveWorkflowSuggestion,
    handleDeleteWorkflow,
    handleDismissWorkflowSuggestion,
    handleExportWorkflows,
    handleImportWorkflows,
    handleRenameWorkflow,
    handleSaveWorkflowEdits,
    handleWorkflowFieldChange,
    handleWorkflowStepChange,
    pendingWorkflowExecution,
    rememberWorkflowSequence,
    savedWorkflows,
    setDismissedWorkflowSignatures,
    setEditingWorkflowId,
    setPendingWorkflowExecution,
    setSavedWorkflows,
    setWorkflowCounts,
    setWorkflowImportText,
    setWorkflowRenameDrafts,
    setWorkflowSuggestion,
    teachJarvisWorkflow,
    workflowImportText,
    workflowRenameDrafts,
    workflowSuggestion,
  };
}
