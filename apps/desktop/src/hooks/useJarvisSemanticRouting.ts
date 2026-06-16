import { useCallback, useRef, useState } from "react";

import type {
  ActiveConversationContext,
  CommandIntent,
  ConversationTopicRecord,
  EmbeddingBackend,
  PendingClarification,
  SemanticConversationMemoryRecord,
  SemanticIntentDebugMatch,
  SemanticIntentFeedbackRecord,
} from "../features/command/jarvisCommandTypes";
import {
  buildConversationMemoryText,
  buildLocalSemanticEmbedding,
  buildOllamaSemanticEmbedding,
  buildTransformersSemanticEmbedding,
  describeCommandIntent,
  describeIntentActionType,
  getErrorDetail,
  normalizeControlCommand,
  normalizeLearnedPhrase,
} from "../features/legacy/appHelpers";
import type { TransformersEmbeddingExtractor } from "../features/legacy/appHelpers";
import type { Dispatch, SetStateAction } from "react";

export type JarvisSemanticRoutingConfig = {
  activeConversationContext: ActiveConversationContext | null;
  embeddingBackend: EmbeddingBackend;
  embeddingModelName: string;
  ollamaBaseUrl: string;
  setEmbeddingStatusMessage: (message: string) => void;
  setSemanticConversationMemory: Dispatch<SetStateAction<SemanticConversationMemoryRecord[]>>;
  setLastConversationTopic: Dispatch<SetStateAction<ConversationTopicRecord | null>>;
  setSemanticIntentFeedback: Dispatch<SetStateAction<SemanticIntentFeedbackRecord[]>>;
};

/** Wave C peel: semantic routing state, embeddings, and conversation memory from JarvisAppRoot.logic. */
export function useJarvisSemanticRouting(config?: JarvisSemanticRoutingConfig) {
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [lastSemanticIntentMatches, setLastSemanticIntentMatches] = useState<
    SemanticIntentDebugMatch[]
  >([]);
  const [learnedIntentRenameDrafts, setLearnedIntentRenameDrafts] = useState<Record<number, string>>(
    {},
  );

  const transformersEmbeddingRef = useRef<{
    model: string;
    extractor: TransformersEmbeddingExtractor;
  } | null>(null);
  const semanticIntentEmbeddingCacheRef = useRef<
    Map<string, { embedding: number[]; backend: EmbeddingBackend }>
  >(new Map());

  const buildSemanticEmbeddingWithFallback = useCallback(
    async (text: string) => {
      if (!config) {
        return {
          embedding: buildLocalSemanticEmbedding(text),
          backend: "local" as const,
        };
      }

      const {
        embeddingBackend,
        embeddingModelName,
        ollamaBaseUrl,
        setEmbeddingStatusMessage,
      } = config;

      if (embeddingBackend === "ollama") {
        try {
          const embedding = await buildOllamaSemanticEmbedding(
            ollamaBaseUrl,
            embeddingModelName || "nomic-embed-text",
            text,
          );
          setEmbeddingStatusMessage(
            `Ollama embeddings active: ${embeddingModelName || "nomic-embed-text"}.`,
          );
          return {
            embedding,
            backend: "ollama" as const,
          };
        } catch (error) {
          setEmbeddingStatusMessage(
            getErrorDetail(error, "Ollama embeddings unavailable. Using local fallback."),
          );
        }
      }

      if (embeddingBackend === "transformers") {
        const model = embeddingModelName || "Xenova/all-MiniLM-L6-v2";
        try {
          const result = await buildTransformersSemanticEmbedding(
            model,
            text,
            transformersEmbeddingRef.current,
          );
          transformersEmbeddingRef.current = {
            model,
            extractor: result.extractor,
          };
          setEmbeddingStatusMessage(`Transformers.js embeddings active: ${model}.`);
          return {
            embedding: result.embedding,
            backend: "transformers" as const,
          };
        } catch (error) {
          setEmbeddingStatusMessage(
            getErrorDetail(error, "Transformers.js embeddings unavailable. Using local fallback."),
          );
        }
      }

      return {
        embedding: buildLocalSemanticEmbedding(text),
        backend: "local" as const,
      };
    },
    [config],
  );

  const buildCachedSemanticIntentEmbedding = useCallback(
    async (text: string) => {
      const embeddingBackend = config?.embeddingBackend ?? "local";
      const embeddingModelName = config?.embeddingModelName ?? "default";
      const cacheKey = `${embeddingBackend}:${embeddingModelName || "default"}:${normalizeControlCommand(text)}`;
      const cached = semanticIntentEmbeddingCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const embedding = await buildSemanticEmbeddingWithFallback(text);
      semanticIntentEmbeddingCacheRef.current.set(cacheKey, embedding);
      if (semanticIntentEmbeddingCacheRef.current.size > 240) {
        const firstKey = semanticIntentEmbeddingCacheRef.current.keys().next().value;
        if (firstKey) {
          semanticIntentEmbeddingCacheRef.current.delete(firstKey);
        }
      }
      return embedding;
    },
    [buildSemanticEmbeddingWithFallback, config?.embeddingBackend, config?.embeddingModelName],
  );

  const rememberSemanticConversationTurn = useCallback(
    async (command: string, intent: CommandIntent | null) => {
      if (!config) {
        return;
      }

      const memoryText = buildConversationMemoryText(
        command,
        intent,
        config.activeConversationContext,
      );
      if (!memoryText.trim()) {
        return;
      }

      const embeddingResult = await buildSemanticEmbeddingWithFallback(memoryText);
      const summary = intent
        ? describeCommandIntent(intent)
        : config.activeConversationContext?.label ?? command.trim();
      const record: SemanticConversationMemoryRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: memoryText,
        summary,
        intentKind: intent?.kind ?? null,
        contextLabel: config.activeConversationContext?.label ?? null,
        embedding: embeddingResult.embedding,
        embeddingBackend: embeddingResult.backend,
        createdAt: new Date().toISOString(),
      };

      config.setSemanticConversationMemory((current) => {
        const withoutDuplicate = current.filter(
          (entry) => normalizeControlCommand(entry.summary) !== normalizeControlCommand(summary),
        );
        return [record, ...withoutDuplicate].slice(0, 80);
      });

      if (intent) {
        config.setLastConversationTopic({
          phrase: command.trim(),
          intentLabel: describeCommandIntent(intent),
          actionType: describeIntentActionType(intent),
          contextLabel: config.activeConversationContext?.label ?? null,
          createdAt: new Date().toISOString(),
        });
      }
    },
    [buildSemanticEmbeddingWithFallback, config],
  );

  const rememberSemanticIntentFeedback = useCallback(
    (phrase: string, candidateId: string, candidateLabel: string, accepted: boolean) => {
      if (!config) {
        return;
      }

      const normalizedPhrase = normalizeLearnedPhrase(phrase);
      if (!normalizedPhrase) {
        return;
      }

      config.setSemanticIntentFeedback((current) =>
        [
          ...current.filter(
            (entry) =>
              !(
                entry.normalizedPhrase === normalizedPhrase && entry.candidateId === candidateId
              ),
          ),
        ].slice(0, 120),
      );
    },
    [config],
  );

  return {
    pendingClarification,
    setPendingClarification,
    lastSemanticIntentMatches,
    setLastSemanticIntentMatches,
    learnedIntentRenameDrafts,
    setLearnedIntentRenameDrafts,
    transformersEmbeddingRef,
    semanticIntentEmbeddingCacheRef,
    buildSemanticEmbeddingWithFallback,
    buildCachedSemanticIntentEmbedding,
    rememberSemanticConversationTurn,
    rememberSemanticIntentFeedback,
  };
}
