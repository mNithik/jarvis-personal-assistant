import { useEffect, useState } from "react";

import {
  CLOUD_MODEL_PROVIDERS,
  MODEL_PROVIDER_LABELS,
  MODEL_PROVIDER_PRESETS,
  MODEL_ROUTER_CONFIG_STORAGE_KEY,
  MODEL_ROUTER_USAGE_STORAGE_KEY,
  OPENAI_COMPATIBLE_PROVIDER_IDS,
  PAID_MODEL_PROVIDERS,
  createDefaultModelRouterConfig,
  getErrorDetail,
  mergeModelRouterConfig,
  type ActiveConversationContext,
  type ConversationTopicRecord,
  type ConversationTurn,
  type GeneratedModelDraft,
  type ModelBenchmarkResult,
  type ModelComparisonResult,
  type ModelComparisonRun,
  type ModelProviderConfig,
  type ModelProviderId,
  type ModelProviderUsageRecord,
  type ModelRouteDecision,
  type ModelRouterConfig,
  type ModelRouterTestResult,
  type ModelTaskType,
  type UserPreferenceMemory,
} from "../features/legacy/appHelpers";
import {
  callModelProviderChat,
  listProviderKeyStatus,
  testProviderKey,
} from "../services/jarvisApi";
import { useJarvisModelProviders } from "./useJarvisModelProviders";

type CommandResult = {
  title: string;
  detail: string;
  routeLabel?: string;
};

type UseJarvisModelRouterOptions = {
  activeConversationContext: ActiveConversationContext | null;
  appendConversationTurn: (role: "user" | "jarvis", text: string) => void;
  conversationTurns: ConversationTurn[];
  lastConversationTopic: ConversationTopicRecord | null;
  setCommandResult: (result: CommandResult | null) => void;
  setStatusMessage: (message: string) => void;
  speakIfEnabled: (text: string) => void;
  userPreferenceMemory: UserPreferenceMemory;
};

/** Wave 2 peel: model router state, persistence, and routing from JarvisAppRoot.logic */
export function useJarvisModelRouter({
  activeConversationContext,
  appendConversationTurn,
  conversationTurns,
  lastConversationTopic,
  setCommandResult,
  setStatusMessage,
  speakIfEnabled,
  userPreferenceMemory,
}: UseJarvisModelRouterOptions) {
  const { saveProviderApiKey: persistProviderApiKey, removeProviderApiKey } = useJarvisModelProviders();

  const [modelRouterConfig, setModelRouterConfig] = useState<ModelRouterConfig>(() =>
    createDefaultModelRouterConfig(),
  );
  const [modelRouterStatusMessage, setModelRouterStatusMessage] = useState(
    "Zero-cost model router ready. Local stays default.",
  );
  const [modelRouterTestResult, setModelRouterTestResult] = useState<ModelRouterTestResult | null>(null);
  const [latestGeneratedDraft, setLatestGeneratedDraft] = useState<GeneratedModelDraft | null>(null);
  const [modelProviderUsage, setModelProviderUsage] = useState<ModelProviderUsageRecord[]>([]);
  const [modelBenchmarkResults, setModelBenchmarkResults] = useState<ModelBenchmarkResult[]>([]);
  const [modelComparisonPrompt, setModelComparisonPrompt] = useState("");
  const [modelComparisonRun, setModelComparisonRun] = useState<ModelComparisonRun | null>(null);
  const [streamingModelText, setStreamingModelText] = useState("");
  const [modelProviderKeyStatus, setModelProviderKeyStatus] = useState<Record<string, boolean>>({});
  const [modelProviderKeyPreview, setModelProviderKeyPreview] = useState<Record<string, string>>({});
  const [isTestingModelRouter, setIsTestingModelRouter] = useState(false);
  const [isBenchmarkingModels, setIsBenchmarkingModels] = useState(false);
  const [isComparingModels, setIsComparingModels] = useState(false);
  const [isGeneratingModelDraft, setIsGeneratingModelDraft] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_ROUTER_CONFIG_STORAGE_KEY);
      if (saved) {
        setModelRouterConfig(mergeModelRouterConfig(JSON.parse(saved) as Partial<ModelRouterConfig>));
      }
    } catch {
      setModelRouterConfig(createDefaultModelRouterConfig());
      setStatusMessage("JARVIS could not load model router settings.");
    }
  }, [setStatusMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MODEL_ROUTER_CONFIG_STORAGE_KEY,
        JSON.stringify({
          ...modelRouterConfig,
          providers: Object.fromEntries(
            (Object.keys(modelRouterConfig.providers) as ModelProviderId[]).map((providerId) => [
              { ...modelRouterConfig.providers[providerId], apiKey: "" },
            ]),
          ),
        }),
      );
    } catch {
      setStatusMessage("JARVIS could not persist model router settings.");
    }
  }, [modelRouterConfig, setStatusMessage]);

  useEffect(() => {
    void refreshProviderKeyStatuses();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_ROUTER_USAGE_STORAGE_KEY);
      if (saved) {
        setModelProviderUsage(JSON.parse(saved) as ModelProviderUsageRecord[]);
      }
    } catch {
      setModelProviderUsage([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MODEL_ROUTER_USAGE_STORAGE_KEY,
        JSON.stringify(modelProviderUsage.slice(0, 80)),
      );
    } catch {
      setStatusMessage("JARVIS could not persist model provider usage.");
    }
  }, [modelProviderUsage, setStatusMessage]);

  function updateModelProviderConfig(providerId: ModelProviderId, patch: Partial<ModelProviderConfig>) {
    setModelRouterConfig((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: {
          ...current.providers[providerId],
          ...patch,
        },
      },
    }));
  }

  async function saveProviderApiKey(providerId: ModelProviderId, apiKey: string) {
    const status = await persistProviderApiKey(providerId, apiKey);
    updateModelProviderConfig(providerId, { apiKey: "" });
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({
      ...current,
      [providerId]: status.maskedPreview ?? "",
    }));
    setModelRouterStatusMessage(
      status.hasApiKey
        ? `${MODEL_PROVIDER_LABELS[providerId]} API key saved in Windows Credential Manager.`
        : `${MODEL_PROVIDER_LABELS[providerId]} API key is not saved.`,
    );
  }

  async function refreshProviderKeyStatuses() {
    try {
      const statuses = await listProviderKeyStatus();
      const statusMap: Record<string, boolean> = {};
      const previewMap: Record<string, string> = {};
      for (const status of statuses) {
        statusMap[status.providerId] = status.hasApiKey;
        previewMap[status.providerId] = status.maskedPreview ?? "";
      }
      setModelProviderKeyStatus(statusMap);
      setModelProviderKeyPreview(previewMap);
    } catch {
      setModelRouterStatusMessage("Could not read Windows Credential Manager provider status.");
    }
  }

  async function deleteSavedProviderApiKey(providerId: ModelProviderId) {
    const status = await removeProviderApiKey(providerId);
    updateModelProviderConfig(providerId, { apiKey: "" });
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({ ...current, [providerId]: "" }));
    setModelRouterStatusMessage(
      `${MODEL_PROVIDER_LABELS[providerId]} API key deleted from Windows Credential Manager.`,
    );
  }

  async function testSavedProviderApiKey(providerId: ModelProviderId) {
    const status = await testProviderKey(providerId);
    setModelProviderKeyStatus((current) => ({ ...current, [providerId]: status.hasApiKey }));
    setModelProviderKeyPreview((current) => ({
      ...current,
      [providerId]: status.maskedPreview ?? "",
    }));
    setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} key exists in Windows Credential Manager.`);
  }

  function revealModelText(text: string) {
    setStreamingModelText("");
    const words = text.split(/(\s+)/);
    let index = 0;
    const interval = window.setInterval(() => {
      index += 8;
      setStreamingModelText(words.slice(0, index).join(""));
      if (index >= words.length) {
        window.clearInterval(interval);
      }
    }, 35);
  }

  function applyModelProviderPreset(presetId: string) {
    const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    updateModelProviderConfig(preset.providerId, {
      chatModel: preset.chatModel,
      codingModel: preset.codingModel,
      reasoningModel: preset.reasoningModel,
    });
    setModelRouterStatusMessage(
      `${preset.label} preset applied to ${MODEL_PROVIDER_LABELS[preset.providerId]}.`,
    );
  }

  function setPreferredModelProvider(taskType: "chat" | "coding" | "reasoning", providerId: ModelProviderId) {
    setModelRouterConfig((current) => {
      if (taskType === "chat") {
        return { ...current, defaultProvider: providerId };
      }
      if (taskType === "coding") {
        return { ...current, codingProvider: providerId };
      }
      return { ...current, reasoningProvider: providerId };
    });
    setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} is now preferred for ${taskType}.`);
  }

  function updateModelRouterConfig(patch: Partial<ModelRouterConfig>) {
    setModelRouterConfig((current) => mergeModelRouterConfig({ ...current, ...patch }));
  }

  function rememberModelProviderUsage(record: Omit<ModelProviderUsageRecord, "id" | "createdAt">) {
    setModelProviderUsage((current) =>
      [
        {
          ...record,
          id: `model-usage-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 80),
    );
  }

  function classifyModelTask(prompt: string): ModelTaskType {
    const normalized = prompt.toLowerCase();
    if (
      /\b(code|coding|repo|github|codex|debug|bug|typescript|rust|backend|frontend|api|database|schema|test|architecture)\b/.test(
        normalized,
      )
    ) {
      return "coding";
    }
    if (/\b(reason|plan|compare|decide|analyze|strategy|architecture|think through)\b/.test(normalized)) {
      return "reasoning";
    }
    if (/\b(private|memory|personal|remember|preference|profile)\b/.test(normalized)) {
      return "private_memory";
    }
    if (/\b(draft|write|generate|rewrite|summarize)\b/.test(normalized)) {
      return "draft";
    }
    return "general_chat";
  }

  function isSensitiveModelPrompt(prompt: string, taskType: ModelTaskType) {
    const normalized = prompt.toLowerCase();
    return (
      taskType === "private_memory" ||
      /\b(private|personal|password|token|api key|secret|email|gmail|calendar|birthday|address|phone|bank|receipt|invoice|medical|health|resume|school id|student id)\b/.test(
        normalized,
      )
    );
  }

  function resolveModelRoute(prompt: string, requestedTaskType?: ModelTaskType): ModelRouteDecision {
    const taskType = requestedTaskType ?? classifyModelTask(prompt);
    const preferredProvider =
      taskType === "coding"
        ? modelRouterConfig.codingProvider
        : taskType === "reasoning"
          ? modelRouterConfig.reasoningProvider
          : taskType === "private_memory"
            ? modelRouterConfig.privateProvider
            : modelRouterConfig.defaultProvider;
    const providerId =
      taskType === "private_memory" && !modelRouterConfig.allowCloudForPrivateMemory
        ? modelRouterConfig.privateProvider
        : preferredProvider;
    const provider = modelRouterConfig.providers[providerId];
    const model =
      taskType === "coding"
        ? provider.codingModel || provider.chatModel
        : taskType === "reasoning"
          ? provider.reasoningModel || provider.chatModel
          : provider.chatModel || provider.reasoningModel || provider.codingModel;

    if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is paid and blocked because ENABLE_PAID_PROVIDERS is off.`,
      };
    }
    if (PAID_MODEL_PROVIDERS.has(providerId) && modelRouterConfig.maxMonthlyApiSpend <= 0) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is blocked by MAX_MONTHLY_API_SPEND=0.`,
      };
    }
    if (
      taskType === "private_memory" &&
      CLOUD_MODEL_PROVIDERS.has(providerId) &&
      !modelRouterConfig.allowCloudForPrivateMemory
    ) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: "Private memory-heavy requests are local-only unless cloud memory routing is explicitly enabled.",
      };
    }
    if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} is registered but its non-OpenAI-compatible adapter is not wired yet.`,
      };
    }
    if (!provider.baseUrl.trim()) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs a base URL before JARVIS can call it.`,
      };
    }
    if (!model.trim()) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs a model name before JARVIS can call it.`,
      };
    }
    if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
      return {
        taskType,
        providerId,
        model,
        baseUrl: provider.baseUrl,
        blocked: true,
        reason: `${MODEL_PROVIDER_LABELS[providerId]} needs an API key first.`,
      };
    }

    return {
      taskType,
      providerId,
      model,
      baseUrl: provider.baseUrl,
      blocked: false,
      reason:
        taskType === "coding" || taskType === "reasoning"
          ? `${MODEL_PROVIDER_LABELS[providerId]} selected for ${taskType}.`
          : `${MODEL_PROVIDER_LABELS[providerId]} selected with zero-cost guardrails active.`,
    };
  }

  function buildNaturalGenerationSystemPrompt(taskType: ModelTaskType) {
    const contextLines = [
      activeConversationContext ? `Active context: ${activeConversationContext.label}.` : null,
      lastConversationTopic ? `Recent topic: ${lastConversationTopic.intentLabel}.` : null,
      userPreferenceMemory.musicProvider ? `Music preference: ${userPreferenceMemory.musicProvider}.` : null,
      userPreferenceMemory.defaultWorkspaceName
        ? `Default workspace: ${userPreferenceMemory.defaultWorkspaceName}.`
        : null,
    ].filter(Boolean);
    return [
      "You are JARVIS, a local-first personal assistant.",
      "Speak naturally, clearly, and directly.",
      "Do not claim you saved, sent, ran, or changed anything. Return draft text only.",
      taskType === "coding"
        ? "For coding requests, be implementation-focused and practical."
        : "For daily assistant requests, be helpful without overexplaining.",
      ...contextLines,
    ].join("\n");
  }

  async function callConfiguredModel(prompt: string, requestedTaskType?: ModelTaskType) {
    const route = resolveModelRoute(prompt, requestedTaskType);
    if (route.blocked) {
      throw new Error(route.reason);
    }

    return callModelProviderChat({
      providerId: route.providerId,
      baseUrl: route.baseUrl,
      apiKey: null,
      model: route.model,
      temperature: route.taskType === "coding" ? 0.25 : 0.45,
      maxTokens: route.taskType === "coding" || route.taskType === "reasoning" ? 1800 : 900,
      messages: [
        { role: "system", content: buildNaturalGenerationSystemPrompt(route.taskType) },
        ...conversationTurns.slice(-6).map((turn) => ({
          role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
          content: turn.text,
        })),
        { role: "user", content: prompt },
      ],
    });
  }

  async function handleTestModelProvider(providerId: ModelProviderId) {
    setIsTestingModelRouter(true);
    const prompt = `Reply with one short sentence confirming ${MODEL_PROVIDER_LABELS[providerId]} is reachable.`;
    const provider = modelRouterConfig.providers[providerId];
    const taskType: ModelTaskType =
      providerId === modelRouterConfig.codingProvider ? "coding" : "general_chat";
    try {
      const route = resolveModelRoute(prompt, taskType);
      const requestedProviderRoute =
        route.providerId === providerId
          ? route
          : {
              ...route,
              providerId,
              baseUrl: provider.baseUrl,
              model: provider.chatModel || provider.codingModel || provider.reasoningModel,
              blocked: false,
              reason: `Testing ${MODEL_PROVIDER_LABELS[providerId]}.`,
            };
      if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} is blocked because paid providers are disabled.`);
      }
      if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
        throw new Error(
          `${MODEL_PROVIDER_LABELS[providerId]} is registered, but its direct adapter is not wired yet.`,
        );
      }
      if (!requestedProviderRoute.baseUrl.trim() || !requestedProviderRoute.model.trim()) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} needs a base URL and model name first.`);
      }
      if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
        throw new Error(`${MODEL_PROVIDER_LABELS[providerId]} needs an API key first.`);
      }
      const response = await callModelProviderChat({
        providerId,
        baseUrl: requestedProviderRoute.baseUrl,
        apiKey: null,
        model: requestedProviderRoute.model,
        temperature: 0.1,
        maxTokens: 120,
        messages: [
          { role: "system", content: "You are a model health checker. Reply briefly." },
          { role: "user", content: prompt },
        ],
      });
      const result: ModelRouterTestResult = {
        providerId,
        model: requestedProviderRoute.model,
        ok: true,
        message: response.text,
        latencyMs: response.latencyMs,
        checkedAt: new Date().toISOString(),
      };
      setModelRouterTestResult(result);
      setModelRouterStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} replied in ${response.latencyMs}ms.`);
      setCommandResult({
        title: "Model provider reachable",
        detail: `${MODEL_PROVIDER_LABELS[providerId]} (${requestedProviderRoute.model}) replied: ${response.text}`,
      });
      rememberModelProviderUsage({
        providerId,
        model: requestedProviderRoute.model,
        taskType,
        prompt,
        ok: true,
        latencyMs: response.latencyMs,
        totalTokens: response.totalTokens,
      });
    } catch (error) {
      const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} test failed.`);
      const result: ModelRouterTestResult = {
        providerId,
        model: provider.chatModel || provider.codingModel || provider.reasoningModel || "not set",
        ok: false,
        message,
        checkedAt: new Date().toISOString(),
      };
      setModelRouterTestResult(result);
      setModelRouterStatusMessage(result.message);
      setCommandResult({ title: "Model provider test failed", detail: result.message });
      rememberModelProviderUsage({
        providerId,
        model: result.model,
        taskType,
        prompt,
        ok: false,
        latencyMs: null,
        totalTokens: null,
        errorMessage: message,
      });
    } finally {
      setIsTestingModelRouter(false);
    }
  }

  async function generateSafeModelDraft(prompt: string, taskType?: ModelTaskType) {
    setIsGeneratingModelDraft(true);
    try {
      const route = resolveModelRoute(prompt, taskType);
      const response = await callConfiguredModel(prompt, route.taskType);
      const draft: GeneratedModelDraft = {
        id: `draft-${Date.now()}`,
        prompt,
        taskType: route.taskType,
        providerId: route.providerId,
        model: route.model,
        text: response.text,
        latencyMs: response.latencyMs,
        createdAt: new Date().toISOString(),
      };
      setLatestGeneratedDraft(draft);
      revealModelText(response.text);
      setModelRouterStatusMessage(
        `Draft generated with ${MODEL_PROVIDER_LABELS[route.providerId]} in ${response.latencyMs}ms. It was not saved or sent.`,
      );
      setCommandResult({
        title: "Draft generated",
        detail: `${response.text}\n\nProvider: ${MODEL_PROVIDER_LABELS[route.providerId]} | Model: ${route.model} | Nothing was saved, sent, or run.`,
        routeLabel: `Model Router -> ${MODEL_PROVIDER_LABELS[route.providerId]}`,
      });
      rememberModelProviderUsage({
        providerId: route.providerId,
        model: route.model,
        taskType: route.taskType,
        prompt,
        ok: true,
        latencyMs: response.latencyMs,
        totalTokens: response.totalTokens,
      });
      appendConversationTurn("jarvis", "I generated a draft only. I did not save, send, or run it.");
      speakIfEnabled("I generated a draft only. I did not save, send, or run it.");
      return draft;
    } catch (error) {
      const route = resolveModelRoute(prompt, taskType);
      rememberModelProviderUsage({
        providerId: route.providerId,
        model: route.model || "not set",
        taskType: route.taskType,
        prompt,
        ok: false,
        latencyMs: null,
        totalTokens: null,
        errorMessage: getErrorDetail(error, "Model draft generation failed."),
      });
      throw error;
    } finally {
      setIsGeneratingModelDraft(false);
    }
  }

  async function runModelBenchmark() {
    setIsBenchmarkingModels(true);
    const benchmarkPrompt = "Reply with exactly: benchmark ok";
    const providerIds = Array.from(
      new Set<ModelProviderId>([
        modelRouterConfig.defaultProvider,
        modelRouterConfig.codingProvider,
        modelRouterConfig.reasoningProvider,
        "gemini",
        "groq",
        "openrouter",
      ]),
    );
    const results: ModelBenchmarkResult[] = [];

    for (const providerId of providerIds) {
      const provider = modelRouterConfig.providers[providerId];
      const model = provider.chatModel || provider.codingModel || provider.reasoningModel;
      try {
        if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
          throw new Error("Paid provider blocked.");
        }
        if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
          throw new Error("Adapter not wired yet.");
        }
        if (!provider.baseUrl.trim() || !model.trim()) {
          throw new Error("Missing base URL or model.");
        }
        if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
          throw new Error("Missing API key.");
        }
        const response = await callModelProviderChat({
          providerId,
          baseUrl: provider.baseUrl,
          apiKey: null,
          model,
          temperature: 0,
          maxTokens: 40,
          messages: [
            { role: "system", content: "You are a benchmark probe. Follow the user exactly." },
            { role: "user", content: benchmarkPrompt },
          ],
        });
        results.push({
          id: `benchmark-${Date.now()}-${providerId}`,
          providerId,
          model,
          ok: true,
          latencyMs: response.latencyMs,
          message: response.text,
          checkedAt: new Date().toISOString(),
        });
        rememberModelProviderUsage({
          providerId,
          model,
          taskType: "general_chat",
          prompt: benchmarkPrompt,
          ok: true,
          latencyMs: response.latencyMs,
          totalTokens: response.totalTokens,
        });
      } catch (error) {
        const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} benchmark failed.`);
        results.push({
          id: `benchmark-${Date.now()}-${providerId}`,
          providerId,
          model: model || "not set",
          ok: false,
          latencyMs: null,
          message,
          checkedAt: new Date().toISOString(),
        });
        rememberModelProviderUsage({
          providerId,
          model: model || "not set",
          taskType: "general_chat",
          prompt: benchmarkPrompt,
          ok: false,
          latencyMs: null,
          totalTokens: null,
          errorMessage: message,
        });
      }
    }

    setModelBenchmarkResults(results);
    setModelRouterStatusMessage(
      `Benchmark finished: ${results.filter((result) => result.ok).length}/${results.length} providers reachable.`,
    );
    setCommandResult({
      title: "Model benchmark finished",
      detail: results
        .map((result) =>
          `${MODEL_PROVIDER_LABELS[result.providerId]}: ${result.ok ? `${result.latencyMs}ms` : result.message}`,
        )
        .join(" | "),
    });
    setIsBenchmarkingModels(false);
  }

  async function compareModelResponses(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error("Enter a prompt before comparing models.");
    }
    setIsComparingModels(true);
    const taskType = classifyModelTask(trimmedPrompt);
    const providerIds = Array.from(
      new Set<ModelProviderId>([
        modelRouterConfig.defaultProvider,
        modelRouterConfig.codingProvider,
        modelRouterConfig.reasoningProvider,
        "local_ollama",
        "gemini",
        "groq",
        "openrouter",
      ]),
    ).slice(0, 5);
    const results: ModelComparisonResult[] = [];

    for (const providerId of providerIds) {
      const provider = modelRouterConfig.providers[providerId];
      const model =
        taskType === "coding"
          ? provider.codingModel || provider.chatModel
          : taskType === "reasoning"
            ? provider.reasoningModel || provider.chatModel
            : provider.chatModel || provider.reasoningModel || provider.codingModel;
      try {
        if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
          throw new Error("Paid provider blocked.");
        }
        if (!OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
          throw new Error("Adapter not wired yet.");
        }
        if (!provider.baseUrl.trim() || !model.trim()) {
          throw new Error("Missing base URL or model.");
        }
        if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
          throw new Error("Missing API key.");
        }
        if (
          CLOUD_MODEL_PROVIDERS.has(providerId) &&
          isSensitiveModelPrompt(trimmedPrompt, taskType) &&
          !modelRouterConfig.allowCloudForPrivateMemory
        ) {
          throw new Error("Skipped cloud for sensitive prompt. Enable cloud private mode to compare it.");
        }
        const response = await callModelProviderChat({
          providerId,
          baseUrl: provider.baseUrl,
          apiKey: null,
          model,
          temperature: 0.35,
          maxTokens: 500,
          messages: [
            { role: "system", content: buildNaturalGenerationSystemPrompt(taskType) },
            { role: "user", content: trimmedPrompt },
          ],
        });
        results.push({
          id: `model-compare-${Date.now()}-${providerId}`,
          providerId,
          model,
          ok: true,
          text: response.text,
          latencyMs: response.latencyMs,
        });
        setModelComparisonRun({
          prompt: trimmedPrompt,
          taskType,
          createdAt: new Date().toISOString(),
          results: [...results],
        });
        rememberModelProviderUsage({
          providerId,
          model,
          taskType,
          prompt: trimmedPrompt,
          ok: true,
          latencyMs: response.latencyMs,
          totalTokens: response.totalTokens,
        });
      } catch (error) {
        const message = getErrorDetail(error, `${MODEL_PROVIDER_LABELS[providerId]} comparison failed.`);
        results.push({
          id: `model-compare-${Date.now()}-${providerId}`,
          providerId,
          model: model || "not set",
          ok: false,
          text: "",
          latencyMs: null,
          errorMessage: message,
        });
        setModelComparisonRun({
          prompt: trimmedPrompt,
          taskType,
          createdAt: new Date().toISOString(),
          results: [...results],
        });
        rememberModelProviderUsage({
          providerId,
          model: model || "not set",
          taskType,
          prompt: trimmedPrompt,
          ok: false,
          latencyMs: null,
          totalTokens: null,
          errorMessage: message,
        });
      }
    }

    setModelComparisonRun({
      prompt: trimmedPrompt,
      taskType,
      createdAt: new Date().toISOString(),
      results,
    });
    setModelRouterStatusMessage(`Compared ${results.length} model route${results.length === 1 ? "" : "s"}.`);
    setCommandResult({
      title: "Model comparison ready",
      detail: results
        .map((result) =>
          `${MODEL_PROVIDER_LABELS[result.providerId]}: ${result.ok ? `${result.latencyMs}ms` : result.errorMessage}`,
        )
        .join(" | "),
      routeLabel: "Model Router",
    });
    setIsComparingModels(false);
  }

  function chooseModelComparisonWinner(providerId: ModelProviderId, taskType?: ModelTaskType) {
    const comparisonTaskType = taskType ?? modelComparisonRun?.taskType ?? "general_chat";
    const winner = modelComparisonRun?.results.find((result) => result.providerId === providerId && result.ok);
    if (modelComparisonRun && !winner) {
      throw new Error(
        `${MODEL_PROVIDER_LABELS[providerId]} did not have a successful result in the latest comparison.`,
      );
    }
    const preference =
      comparisonTaskType === "coding"
        ? "coding"
        : comparisonTaskType === "reasoning"
          ? "reasoning"
          : "chat";
    setPreferredModelProvider(preference, providerId);
    setCommandResult({
      title: "Model winner selected",
      detail: `${MODEL_PROVIDER_LABELS[providerId]} is now preferred for ${preference}.`,
    });
    setStatusMessage(`${MODEL_PROVIDER_LABELS[providerId]} selected as model winner.`);
  }

  function recommendModelRoutesFromHistory() {
    const usableStats = new Map<
      ModelProviderId,
      { ok: number; failed: number; latencyTotal: number; latencyCount: number }
    >();
    for (const providerId of Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[]) {
      usableStats.set(providerId, { ok: 0, failed: 0, latencyTotal: 0, latencyCount: 0 });
    }

    for (const result of modelBenchmarkResults) {
      const stats = usableStats.get(result.providerId);
      if (!stats) {
        continue;
      }
      if (result.ok) {
        stats.ok += 2;
      } else {
        stats.failed += 2;
      }
      if (result.latencyMs) {
        stats.latencyTotal += result.latencyMs;
        stats.latencyCount += 1;
      }
    }

    for (const usage of modelProviderUsage.slice(0, 30)) {
      const stats = usableStats.get(usage.providerId);
      if (!stats) {
        continue;
      }
      if (usage.ok) {
        stats.ok += 1;
      } else {
        stats.failed += 1;
      }
      if (usage.latencyMs) {
        stats.latencyTotal += usage.latencyMs;
        stats.latencyCount += 1;
      }
    }

    const scoreProvider = (providerId: ModelProviderId, taskType: "chat" | "coding" | "reasoning") => {
      const provider = modelRouterConfig.providers[providerId];
      const model =
        taskType === "coding"
          ? provider.codingModel || provider.chatModel
          : taskType === "reasoning"
            ? provider.reasoningModel || provider.chatModel
            : provider.chatModel || provider.reasoningModel || provider.codingModel;
      if (!model || !provider.baseUrl) {
        return -1000;
      }
      if (PAID_MODEL_PROVIDERS.has(providerId) && !modelRouterConfig.enablePaidProviders) {
        return -1000;
      }
      if (CLOUD_MODEL_PROVIDERS.has(providerId) && !modelProviderKeyStatus[providerId]) {
        return -200;
      }
      const stats = usableStats.get(providerId) ?? { ok: 0, failed: 0, latencyTotal: 0, latencyCount: 0 };
      const avgLatency = stats.latencyCount > 0 ? stats.latencyTotal / stats.latencyCount : 3000;
      const localBonus = providerId === "local_ollama" || providerId === "lm_studio" ? 6 : 0;
      const taskBonus =
        taskType === "coding" && (providerId === "nvidia_nim" || providerId === "groq" || providerId === "openrouter")
          ? 5
          : taskType === "reasoning" &&
              (providerId === "nvidia_nim" || providerId === "gemini" || providerId === "openrouter")
            ? 5
            : 0;
      return stats.ok * 12 - stats.failed * 10 - avgLatency / 500 + localBonus + taskBonus;
    };

    const pick = (taskType: "chat" | "coding" | "reasoning") =>
      (Object.keys(MODEL_PROVIDER_LABELS) as ModelProviderId[])
        .map((providerId) => ({ providerId, score: scoreProvider(providerId, taskType) }))
        .sort((a, b) => b.score - a.score)[0];

    const chat = pick("chat");
    const coding = pick("coding");
    const reasoning = pick("reasoning");

    setModelRouterConfig((current) => ({
      ...current,
      defaultProvider: chat.providerId,
      codingProvider: coding.providerId,
      reasoningProvider: reasoning.providerId,
    }));
    setModelRouterStatusMessage(
      `Recommended routes applied: chat ${MODEL_PROVIDER_LABELS[chat.providerId]}, coding ${MODEL_PROVIDER_LABELS[coding.providerId]}, reasoning ${MODEL_PROVIDER_LABELS[reasoning.providerId]}.`,
    );
    setCommandResult({
      title: "Model routes recommended",
      detail: `Chat: ${MODEL_PROVIDER_LABELS[chat.providerId]} | Coding: ${MODEL_PROVIDER_LABELS[coding.providerId]} | Reasoning: ${MODEL_PROVIDER_LABELS[reasoning.providerId]}. Run a benchmark first for stronger recommendations.`,
    });
  }

  return {
    applyModelProviderPreset,
    buildNaturalGenerationSystemPrompt,
    callConfiguredModel,
    chooseModelComparisonWinner,
    classifyModelTask,
    compareModelResponses,
    createDefaultModelRouterConfig,
    deleteSavedProviderApiKey,
    generateSafeModelDraft,
    handleTestModelProvider,
    isBenchmarkingModels,
    isComparingModels,
    isGeneratingModelDraft,
    isSensitiveModelPrompt,
    isTestingModelRouter,
    latestGeneratedDraft,
    modelBenchmarkResults,
    modelComparisonPrompt,
    modelComparisonRun,
    modelProviderKeyPreview,
    modelProviderKeyStatus,
    modelProviderUsage,
    modelRouterConfig,
    modelRouterStatusMessage,
    modelRouterTestResult,
    recommendModelRoutesFromHistory,
    refreshProviderKeyStatuses,
    rememberModelProviderUsage,
    resolveModelRoute,
    revealModelText,
    runModelBenchmark,
    saveProviderApiKey,
    setIsBenchmarkingModels,
    setIsComparingModels,
    setIsGeneratingModelDraft,
    setIsTestingModelRouter,
    setLatestGeneratedDraft,
    setModelBenchmarkResults,
    setModelComparisonPrompt,
    setModelComparisonRun,
    setModelProviderKeyPreview,
    setModelProviderKeyStatus,
    setModelProviderUsage,
    setModelRouterConfig,
    setModelRouterStatusMessage,
    setModelRouterTestResult,
    setPreferredModelProvider,
    setStreamingModelText,
    streamingModelText,
    testSavedProviderApiKey,
    updateModelProviderConfig,
    updateModelRouterConfig,
  };
}
