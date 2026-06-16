import { useCallback } from "react";

import {
  createBuildHandoffArtifact,
  generateMissingSkillPlanWithOllama,
  launchExecutorHandoff,
} from "../services/jarvisApi";
import type {
  AutonomousBuildStatus,
  BuildHandoffArtifact,
  MissingSkillPlan,
  SkillBuildRequest,
  SkillImplementationRequest,
} from "../types/jarvis";
import type { ExecutorStatus } from "../types/voice";
import { getErrorDetail } from "../features/legacy/appHelpers";
import type { Dispatch, SetStateAction } from "react";

type CommandResult = {
  title: string;
  detail: string;
};

export type JarvisBuilderAutopilotConfig = {
  assistantName: string;
  autonomousSkillBuildingEnabled: boolean;
  skillAutopilotAvailable: boolean;
  missingSkillRequest: string | null;
  missingSkillPlan: MissingSkillPlan | null;
  implementationRequest: SkillImplementationRequest | null;
  executorStatus: ExecutorStatus | null;
  appendConversationTurn: (role: "user" | "jarvis", text: string) => void;
  speakIfEnabled: (text: string) => void;
  setIsGeneratingMissingSkillPlan: Dispatch<SetStateAction<boolean>>;
  setAutonomousBuildStatus: Dispatch<SetStateAction<AutonomousBuildStatus>>;
  setMissingSkillPlan: Dispatch<SetStateAction<MissingSkillPlan | null>>;
  setImplementationRequest: Dispatch<SetStateAction<SkillImplementationRequest | null>>;
  setBuildRequest: Dispatch<SetStateAction<SkillBuildRequest | null>>;
  setHandoffArtifact: Dispatch<SetStateAction<BuildHandoffArtifact | null>>;
  setCommandResult: Dispatch<SetStateAction<CommandResult | null>>;
};

/** Wave C peel: autonomous skill-building handlers from JarvisAppRoot.logic. */
export function useJarvisBuilderAutopilot(config: JarvisBuilderAutopilotConfig) {
  const createImplementationRequest = useCallback(
    (plan: MissingSkillPlan, originalRequest: string): SkillImplementationRequest => ({
      skillName: plan.skillName,
      originalRequest,
      summary: plan.summary,
      userValue: plan.userValue,
      buildSteps: plan.buildSteps,
      permissionsNeeded: plan.permissionsNeeded,
      approvedAt: new Date().toISOString(),
    }),
    [],
  );

  const createBuildRequest = useCallback(
    (nextImplementationRequest: SkillImplementationRequest): SkillBuildRequest => ({
      skillName: nextImplementationRequest.skillName,
      title: `Implement ${nextImplementationRequest.skillName} for JARVIS`,
      prompt: [
        `Implement a new JARVIS skill named "${nextImplementationRequest.skillName}".`,
        `Original user request: ${nextImplementationRequest.originalRequest}`,
        `Goal: ${nextImplementationRequest.summary}`,
        `User value: ${nextImplementationRequest.userValue}`,
        "Required build steps:",
        ...nextImplementationRequest.buildSteps.map((step, index) => `${index + 1}. ${step}`),
        nextImplementationRequest.permissionsNeeded.length > 0
          ? `Permissions to review: ${nextImplementationRequest.permissionsNeeded.join(", ")}`
          : "Permissions to review: none listed yet.",
        "Keep the implementation aligned with JARVIS's existing memory, permission, conversation, and skill architecture.",
      ].join("\n"),
      safetyChecks: [
        "Do not auto-execute risky actions without user approval.",
        "Preserve local-first behavior where practical.",
        "Keep new actions behind the existing JARVIS planner and permission flow.",
      ],
      createdAt: new Date().toISOString(),
    }),
    [],
  );

  const handleCreateHandoffArtifact = useCallback(
    async (request: SkillBuildRequest) => {
      const {
        appendConversationTurn,
        executorStatus,
        setAutonomousBuildStatus,
        setCommandResult,
        setHandoffArtifact,
        speakIfEnabled,
      } = config;

      try {
        const artifact = await createBuildHandoffArtifact(request);
        setHandoffArtifact(artifact);
        setAutonomousBuildStatus("handoff_ready");
        setCommandResult({
          title: "Coding handoff package created",
          detail: artifact.message,
        });
        appendConversationTurn(
          "jarvis",
          `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
        );
        speakIfEnabled(
          `I created a coding handoff package for ${request.skillName}. Manual execution is the next boundary.`,
        );

        if (executorStatus?.configured && executorStatus.available) {
          try {
            const launchMessage = await launchExecutorHandoff(
              artifact.jsonPath,
              artifact.markdownPath,
            );
            setCommandResult({
              title: "Executor bridge launched",
              detail: launchMessage,
            });
            appendConversationTurn("jarvis", "I handed the package to the local coding executor.");
            speakIfEnabled("I handed the package to the local coding executor.");
          } catch {
            setAutonomousBuildStatus("manual_required");
            setCommandResult({
              title: "Executor bridge needs manual help",
              detail:
                "JARVIS created the handoff package, but the local coding executor did not launch successfully.",
            });
          }
        }
      } catch {
        setAutonomousBuildStatus("manual_required");
        setCommandResult({
          title: "Could not create coding handoff package",
          detail:
            "JARVIS prepared the build request, but it could not save the handoff files automatically.",
        });
        appendConversationTurn(
          "jarvis",
          "I prepared the build request, but I could not save the handoff files automatically.",
        );
        speakIfEnabled("I prepared the build request, but I could not save the handoff files.");
      }
    },
    [config],
  );

  const handleAskAdvancedAssistant = useCallback(
    async (requestOverride?: string) => {
      const requestToPlan = requestOverride ?? config.missingSkillRequest;
      if (!requestToPlan) {
        return;
      }

      const {
        appendConversationTurn,
        assistantName,
        autonomousSkillBuildingEnabled,
        setAutonomousBuildStatus,
        setBuildRequest,
        setCommandResult,
        setImplementationRequest,
        setIsGeneratingMissingSkillPlan,
        setMissingSkillPlan,
        skillAutopilotAvailable,
        speakIfEnabled,
      } = config;

      setIsGeneratingMissingSkillPlan(true);
      setAutonomousBuildStatus("planning");

      try {
        const plan = await generateMissingSkillPlanWithOllama(requestToPlan, assistantName);
        setMissingSkillPlan(plan);
        setCommandResult({
          title: "Advanced assistant drafted a plan",
          detail: `JARVIS asked the advanced assistant for help with "${requestToPlan}". Review the suggested skill plan below before doing anything else.`,
        });
        appendConversationTurn(
          "jarvis",
          `I asked the advanced assistant for help. It suggested a skill called ${plan.skillName}.`,
        );
        speakIfEnabled(`I drafted a plan for a new skill called ${plan.skillName}.`);

        if (skillAutopilotAvailable && autonomousSkillBuildingEnabled) {
          const nextImplementationRequest = createImplementationRequest(plan, requestToPlan);
          const nextBuildRequest = createBuildRequest(nextImplementationRequest);
          setImplementationRequest(nextImplementationRequest);
          setBuildRequest(nextBuildRequest);
          setAutonomousBuildStatus("build_request_ready");
          await handleCreateHandoffArtifact(nextBuildRequest);
        }
      } catch (error) {
        const detail = getErrorDetail(
          error,
          "JARVIS could not get a missing-skill plan from the advanced assistant right now.",
        );
        setAutonomousBuildStatus("manual_required");
        setCommandResult({
          title: "Advanced assistant unavailable",
          detail,
        });
        appendConversationTurn(
          "jarvis",
          `I tried to ask the advanced assistant for a missing-skill plan, but it failed: ${detail}`,
        );
        speakIfEnabled("I could not get the advanced assistant plan right now.");
      } finally {
        setIsGeneratingMissingSkillPlan(false);
      }
    },
    [config, createBuildRequest, createImplementationRequest, handleCreateHandoffArtifact],
  );

  const handleApproveSkillPlan = useCallback(() => {
    const { missingSkillPlan, missingSkillRequest } = config;
    if (!missingSkillPlan || !missingSkillRequest) {
      return;
    }

    const nextImplementationRequest = createImplementationRequest(
      missingSkillPlan,
      missingSkillRequest,
    );

    config.setImplementationRequest(nextImplementationRequest);
    config.setBuildRequest(null);
    config.setAutonomousBuildStatus("implementation_brief_ready");
    config.setCommandResult({
      title: "Skill plan approved for implementation",
      detail:
        "JARVIS converted the approved skill plan into a structured implementation brief. Review it below before building anything.",
    });
    config.appendConversationTurn(
      "jarvis",
      `I turned the approved ${missingSkillPlan.skillName} plan into an implementation brief.`,
    );
    config.speakIfEnabled(
      `I turned the ${missingSkillPlan.skillName} plan into an implementation brief.`,
    );
  }, [config, createImplementationRequest]);

  const handleGenerateBuildRequest = useCallback(() => {
    if (!config.implementationRequest) {
      return;
    }

    const nextBuildRequest = createBuildRequest(config.implementationRequest);

    config.setBuildRequest(nextBuildRequest);
    config.setAutonomousBuildStatus("build_request_ready");
    config.setCommandResult({
      title: "Build request created",
      detail:
        "JARVIS turned the implementation brief into a concrete coding-agent handoff request.",
    });
    config.appendConversationTurn(
      "jarvis",
      `I created a build request for ${config.implementationRequest.skillName}.`,
    );
    config.speakIfEnabled(`I created a build request for ${config.implementationRequest.skillName}.`);
  }, [config, createBuildRequest]);

  return {
    createImplementationRequest,
    createBuildRequest,
    handleAskAdvancedAssistant,
    handleApproveSkillPlan,
    handleGenerateBuildRequest,
    handleCreateHandoffArtifact,
  };
}
