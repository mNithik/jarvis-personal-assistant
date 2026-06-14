import {
  BrowserAliasRecord,
  ConversationInterpretation,
  EmailRecord,
  FileRecord,
  LearnedIntentRecord,
  NoteRecord,
  SkillBuildRequest,
  VoiceCorrectionRecord,
} from "../../types/jarvis";
import { ConversationBackend, SpeechOutputBackend, VoiceBackend } from "../../types/voice";
import type { GatewayConfig, GatewayPreview, IntegrationHandoff } from "../../services/jarvisApi";
import type { GoogleCalendarEventRecord } from "../../services/googleCalendar";
import type { SpotifyPlaybackState } from "../../services/spotify";

import type {
  ActiveConversationContext,
  ClarificationChoice,
  CommandIntent,
  ConversationContextStackEntry,
  ConversationTopicRecord,
  CorrectionInstruction,
  EmailSignals,
  EmbeddingBackend,
  ExpenseExtraction,
  ExpenseMemoryRecord,
  IntentConfidence,
  MeetingPrepMemoryRecord,
  ModelInterpretationResult,
  NaturalConversationResolution,
  PackageExtraction,
  PackageMemoryRecord,
  PdfTaskCandidate,
  PendingClarification,
  PersonMemoryRecord,
  PlannerTaskRecord,
  PresentedCollectionContext,
  SavedWorkflowRecord,
  SchoolPlanMemoryRecord,
  SemanticConversationMemoryRecord,
  SemanticIntentCandidate,
  SemanticIntentDebugMatch,
  SemanticIntentFeedbackRecord,
  SemanticIntentRank,
  TeachingInstruction,
  TrainingModeSession,
  TransformersEmbeddingExtractor,
  TravelExtraction,
  TravelMemoryRecord,
  UserPreferenceMemory,
  VoiceReplyMode,
} from "../command/jarvisCommandTypes";
import { builtInBrowserAliases, canonicalHostRoots } from "../command/jarvisCommandTypes";
import {
  normalizeDesktopProjectName,
  parseDurationMinutesFromText,
} from "../command/parsers/desktopIntent";
import { parseDesktopControlIntent } from "../command/parsers/desktopIntent";
import { cleanConversationalCommand } from "../command/parsers/desktopIntentUtils";
import {
  addMinutes,
  escapeRegExp,
  extractDueLabel,
  MODEL_PROVIDER_LABELS,
  parseCalendarCommandIntent,
  parseClockTime,
  parseConversationalCommandIntent,
  parseExplicitCommandIntent,
  resolveDayReference,
  splitWorkflowCommand,
  startOfDay,
} from "../command/parsers/explicitIntent";

export function normalizeControlCommand(command: string) {
  return cleanConversationalCommand(command)
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function normalizeLearnedPhrase(command: string) {
  return normalizeControlCommand(command);
}

export function normalizeWakeTranscript(transcript: string) {
  return transcript
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wakeTranscriptMatchesAssistant(transcript: string, assistantName: string) {
  const normalizedTranscript = normalizeWakeTranscript(transcript);
  const wakeName = assistantName.trim().toLowerCase();

  if (!normalizedTranscript || !wakeName) {
    return false;
  }

  const escapedWakeName = escapeRegExp(wakeName);
  const wakePatterns = [
    new RegExp(`\\b${escapedWakeName}\\b`, "i"),
    new RegExp(`\\b(?:hey|hi|hello|okay|ok)\\s+${escapedWakeName}\\b`, "i"),
  ];

  return wakePatterns.some((pattern) => pattern.test(normalizedTranscript));
}

export function extractWakeCommand(transcript: string, assistantName: string) {
  const wakeName = assistantName.trim();
  if (!wakeName) {
    return null;
  }

  const escapedWakeName = escapeRegExp(wakeName);
  const wakeCommandPatterns = [
    new RegExp(`^(?:hey|hi|hello|okay|ok)?\\s*${escapedWakeName}[\\s,:-]+(.+)$`, "i"),
  ];

  for (const pattern of wakeCommandPatterns) {
    const match = transcript.trim().match(pattern);
    const command = match?.[1]?.trim();
    if (command) {
      return cleanConversationalCommand(command);
    }
  }

  return null;
}

export function parseWakeControlIntent(command: string, aliases: BrowserAliasRecord[]) {
  const intent = parseConversationalCommandIntent(command, aliases);
  if (
    intent?.kind === "standby_mode" ||
    intent?.kind === "sleep_mode" ||
    intent?.kind === "shutdown_app"
  ) {
    return intent;
  }

  return null;
}

export function encodeLearnedIntent(intent: CommandIntent) {
  if (intent.kind === "create_calendar_event" || intent.kind === "create_reminder") {
    return JSON.stringify({
      ...intent,
      start: intent.start.toISOString(),
      end: intent.end.toISOString(),
    });
  }

  return JSON.stringify(intent);
}

export function decodeLearnedIntent(record: LearnedIntentRecord): CommandIntent | null {
  try {
    const parsed = JSON.parse(record.intentPayload) as CommandIntent & {
      start?: string;
      end?: string;
    };

    if (parsed.kind === "create_calendar_event" || parsed.kind === "create_reminder") {
      if (!parsed.start || !parsed.end) {
        return null;
      }

      return {
        ...parsed,
        start: new Date(parsed.start),
        end: new Date(parsed.end),
      };
    }

    return parsed;
  } catch {
    return null;
  }
}

export function resolveLearnedIntent(
  command: string,
  learnedIntentMappings: LearnedIntentRecord[],
): CommandIntent | null {
  const normalizedPhrase = normalizeLearnedPhrase(command);
  const record = learnedIntentMappings.find(
    (entry) => entry.normalizedPhrase === normalizedPhrase,
  );

  return record ? decodeLearnedIntent(record) : null;
}

export function getIntentConfidenceFromScore(score: number): IntentConfidence {
  if (score >= 0.84) {
    return "high";
  }
  if (score >= 0.68) {
    return "medium";
  }
  return "low";
}

export function formatIntentConfidenceLabel(confidence: IntentConfidence) {
  if (confidence === "high") {
    return "high confidence";
  }
  if (confidence === "medium") {
    return "medium confidence";
  }
  return "low confidence";
}

export function tokenizeLearnedPhrase(command: string) {
  return normalizeLearnedPhrase(command)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

export function scoreLearnedPhraseSimilarity(left: string, right: string) {
  const leftTokens = tokenizeLearnedPhrase(left);
  const rightTokens = tokenizeLearnedPhrase(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  const jaccard = union > 0 ? overlap / union : 0;
  const leftLastToken = leftTokens[leftTokens.length - 1];
  const rightLastToken = rightTokens[rightTokens.length - 1];
  const prefixBonus =
    leftTokens[0] === rightTokens[0] || leftLastToken === rightLastToken ? 0.15 : 0;

  return Math.min(1, jaccard + prefixBonus);
}

export function findLearnedIntentSuggestion(
  command: string,
  learnedIntentMappings: LearnedIntentRecord[],
) {
  const normalizedPhrase = normalizeLearnedPhrase(command);
  let bestMatch:
    | {
        record: LearnedIntentRecord;
        intent: CommandIntent;
        score: number;
      }
    | null = null;

  for (const record of learnedIntentMappings) {
    const intent = decodeLearnedIntent(record);
    if (!intent) {
      continue;
    }

    const score = scoreLearnedPhraseSimilarity(normalizedPhrase, record.normalizedPhrase);
    if (score < 0.58) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        record,
        intent,
        score,
      };
    }
  }

  return bestMatch;
}

export function buildLearnedIntentFamilySummaries(
  learnedIntentMappings: LearnedIntentRecord[],
) {
  const families = new Map<
    string,
    {
      key: string;
      label: string;
      phraseCount: number;
      totalUseCount: number;
      examplePhrases: string[];
    }
  >();

  for (const record of learnedIntentMappings) {
    const intent = decodeLearnedIntent(record);
    if (!intent) {
      continue;
    }

    const key = `${intent.kind}:${record.intentPayload}`;
    const current = families.get(key);
    if (current) {
      current.phraseCount += 1;
      current.totalUseCount += record.useCount;
      if (current.examplePhrases.length < 3) {
        current.examplePhrases.push(record.phrase);
      }
      continue;
    }

    families.set(key, {
      key,
      label: describeCommandIntent(intent),
      phraseCount: 1,
      totalUseCount: record.useCount,
      examplePhrases: [record.phrase],
    });
  }

  return Array.from(families.values()).sort((left, right) => {
    if (right.phraseCount !== left.phraseCount) {
      return right.phraseCount - left.phraseCount;
    }
    return right.totalUseCount - left.totalUseCount;
  });
}

export function findLearnedIntentFamilySummary(
  intent: CommandIntent,
  learnedIntentMappings: LearnedIntentRecord[],
) {
  const intentPayload = encodeLearnedIntent(intent);
  return buildLearnedIntentFamilySummaries(learnedIntentMappings).find(
    (family) => family.key === `${intent.kind}:${intentPayload}`,
  ) ?? null;
}

export function hashEmbeddingToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildLocalSemanticEmbedding(text: string, dimensions = 64) {
  const tokens = normalizeLearnedPhrase(text)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  const vector = Array.from({ length: dimensions }, () => 0);

  tokens.forEach((token, index) => {
    const features = [
      token,
      index > 0 ? `${tokens[index - 1]} ${token}` : "",
      index < tokens.length - 1 ? `${token} ${tokens[index + 1]}` : "",
    ].filter(Boolean);

    for (const feature of features) {
      const hash = hashEmbeddingToken(feature);
      const bucket = hash % dimensions;
      const direction = hash & 1 ? 1 : -1;
      vector[bucket] += direction * (feature.includes(" ") ? 0.75 : 1);
    }
  });

  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
}

export async function buildOllamaSemanticEmbedding(
  baseUrl: string,
  model: string,
  text: string,
) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embeddings failed with ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    embeddings?: number[][];
    embedding?: number[];
  };
  const embedding = payload.embeddings?.[0] ?? payload.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("Ollama did not return an embedding vector.");
  }

  return embedding;
}

export async function buildTransformersSemanticEmbedding(
  model: string,
  text: string,
  cached:
    | {
        model: string;
        extractor: TransformersEmbeddingExtractor;
      }
    | null,
) {
  let extractor = cached?.model === model ? cached.extractor : null;
  if (!extractor) {
    const transformers = await import("@huggingface/transformers");
    extractor = (await transformers.pipeline(
      "feature-extraction",
      model,
    )) as TransformersEmbeddingExtractor;
  }

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  const tensor = output as {
    data?: Iterable<number>;
    tolist?: () => number[] | number[][];
  };
  const values = tensor.data
    ? Array.from(tensor.data)
    : (() => {
        const listed = tensor.tolist?.();
        if (!listed) {
          return [];
        }
        return Array.isArray(listed[0]) ? (listed[0] as number[]) : (listed as number[]);
      })();

  if (values.length === 0) {
    throw new Error("Transformers.js did not return an embedding vector.");
  }

  return {
    embedding: values,
    extractor,
  };
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function buildConversationMemoryText(
  command: string,
  intent: CommandIntent | null,
  activeContext: ActiveConversationContext | null,
) {
  return [
    command,
    intent ? describeCommandIntent(intent) : "",
    activeContext?.label ?? "",
    activeContext?.kind ?? "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export function findRelevantConversationMemory(
  query: string,
  memory: SemanticConversationMemoryRecord[],
  queryEmbedding?: number[],
) {
  const embedding = queryEmbedding ?? buildLocalSemanticEmbedding(query);
  return memory
    .map((record) => ({
      record,
      score: cosineSimilarity(embedding, record.embedding),
    }))
    .filter((item) => item.score >= 0.22)
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

export function stripSemanticActionQuery(command: string, action: "play" | "queue" | "note" | "task" | "search") {
  let cleaned = cleanConversationalCommand(command)
    .replace(/[?.!]+$/g, "")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/^(?:can you|could you|would you|please)\s+/i, ""],
    [/\s+on spotify$/i, ""],
    [/\s+to spotify$/i, ""],
    [/\s+on google$/i, ""],
    [/\s+to notion$/i, ""],
  ];

  for (const [pattern, replacement] of replacements) {
    cleaned = cleaned.replace(pattern, replacement).trim();
  }

  if (action === "play") {
    cleaned = cleaned
      .replace(/^(?:play|put on|start|listen to)\s+/i, "")
      .replace(/^(?:the\s+)?(?:song|track|music)\s+/i, "")
      .trim();
  } else if (action === "queue") {
    cleaned = cleaned
      .replace(/^(?:queue|add|add song|add track)\s+/i, "")
      .replace(/\s+(?:to|in)\s+(?:the\s+)?queue$/i, "")
      .trim();
  } else if (action === "note") {
    cleaned = cleaned
      .replace(/^(?:make|create|save|write|add)\s+(?:me\s+)?(?:a\s+)?note(?:\s+about|\s+for|\s+to)?\s*/i, "")
      .replace(/^note\s+(?:this\s+)?(?:down\s+)?/i, "")
      .trim();
  } else if (action === "task") {
    cleaned = cleaned
      .replace(/^(?:make|create|add|save)\s+(?:me\s+)?(?:a\s+)?(?:task|todo|to-do)(?:\s+to|\s+for)?\s*/i, "")
      .replace(/^(?:remind me to|i need to)\s+/i, "")
      .trim();
  } else if (action === "search") {
    cleaned = cleaned
      .replace(/^(?:search|google|look up|find)\s+/i, "")
      .replace(/^for\s+/i, "")
      .trim();
  }

  return cleaned;
}

export function buildSemanticIntentCandidates(
  command: string,
  aliases: BrowserAliasRecord[],
  learnedIntentMappings: LearnedIntentRecord[],
  savedWorkflows: SavedWorkflowRecord[],
  userPreferenceMemory: UserPreferenceMemory,
  activeContext: ActiveConversationContext | null,
) {
  const exactParsed = parseConversationalCommandIntent(command, aliases);
  const spotifyQuery = stripSemanticActionQuery(command, "play");
  const spotifyQueueQuery = stripSemanticActionQuery(command, "queue");
  const noteContent = stripSemanticActionQuery(command, "note");
  const taskTitle = stripSemanticActionQuery(command, "task");
  const searchQuery = stripSemanticActionQuery(command, "search");
  const candidates: SemanticIntentCandidate[] = [
    {
      id: "builtin.spotify.play",
      source: "builtin",
      label: "Play music on Spotify",
      examples: [
        "play music on spotify",
        "play this song on spotify",
        "put on a song",
        "start some music",
        "listen to this track",
      ],
      previewIntent: spotifyQuery && spotifyQuery !== command ? { kind: "spotify_play_query", query: spotifyQuery } : { kind: "spotify_play" },
      resolve: () => {
        if (exactParsed?.kind?.startsWith("spotify_")) {
          return exactParsed;
        }
        if (userPreferenceMemory.musicProvider === "spotify" || /\b(song|track|music|spotify|play|listen)\b/i.test(command)) {
          return spotifyQuery && !["music", "song", "track", "something", "some music"].includes(spotifyQuery.toLowerCase())
            ? { kind: "spotify_play_query", query: spotifyQuery }
            : { kind: "spotify_play" };
        }
        return null;
      },
      weight: userPreferenceMemory.musicProvider === "spotify" ? 0.08 : 0,
    },
    {
      id: "builtin.spotify.queue",
      source: "builtin",
      label: "Queue a Spotify track",
      examples: ["queue this on spotify", "add this song to the queue", "put this track next", "queue a song"],
      previewIntent: { kind: "spotify_queue_query", query: spotifyQueueQuery || command },
      resolve: () =>
        spotifyQueueQuery && /\b(queue|add|next)\b/i.test(command)
          ? { kind: "spotify_queue_query", query: spotifyQueueQuery }
          : null,
      weight: userPreferenceMemory.musicProvider === "spotify" ? 0.06 : 0,
    },
    {
      id: "builtin.spotify.like",
      source: "builtin",
      label: "Save current Spotify track",
      examples: ["like this song", "save current track", "add this song to my liked songs", "save this on spotify"],
      previewIntent: { kind: "spotify_like_current" },
      resolve: () => ({ kind: "spotify_like_current" }),
      weight: userPreferenceMemory.musicProvider === "spotify" ? 0.05 : 0,
    },
    {
      id: "builtin.note.create",
      source: "builtin",
      label: "Create a Notion note",
      examples: ["make a note", "save this to notion", "write this down", "note this down", "remember this as a note"],
      previewIntent: { kind: "create_note", content: noteContent || command },
      resolve: () => (noteContent ? { kind: "create_note", content: noteContent } : null),
      weight: userPreferenceMemory.noteApp === "notion" ? 0.04 : 0,
    },
    {
      id: "builtin.task.create",
      source: "builtin",
      label: "Create a task",
      examples: ["add this to my todo", "make a task", "put this in my tasks", "remind me to do this", "create a task"],
      previewIntent: { kind: "create_task_note", title: taskTitle || command, dueLabel: null },
      resolve: () => (taskTitle ? { kind: "create_task_note", title: taskTitle, dueLabel: null } : null),
    },
    {
      id: "builtin.screen.read",
      source: "builtin",
      label: "Read the screen",
      examples: ["read my screen", "what is on my screen", "scan this screen", "read this app", "look at this screen"],
      previewIntent: { kind: "read_screen_text" },
      resolve: () => ({ kind: "read_screen_text" }),
    },
    {
      id: "builtin.screen.summarize",
      source: "builtin",
      label: "Summarize the screen",
      examples: ["summarize my screen", "explain what is on screen", "what does this screen say", "make notes from the screen"],
      previewIntent: { kind: "summarize_screen", mode: "brief" },
      resolve: () => ({ kind: "summarize_screen", mode: "brief" }),
    },
    {
      id: "builtin.google.search",
      source: "builtin",
      label: "Search Google",
      examples: ["search this on google", "look this up", "google this", "find this online", "search for this"],
      previewIntent: { kind: "google_search", query: searchQuery || command },
      resolve: () =>
        hasExplicitSearchLanguage(command) && searchQuery
          ? { kind: "google_search", query: searchQuery }
          : null,
      highThreshold: 0.9,
    },
    {
      id: "builtin.email.list",
      source: "builtin",
      label: "Check unread email",
      examples: ["check my email", "show unread emails", "what emails did I get", "read my inbox"],
      previewIntent: { kind: "list_unread_emails" },
      resolve: () => ({ kind: "list_unread_emails" }),
    },
    {
      id: "builtin.calendar.email",
      source: "builtin",
      label: "Add current email to Calendar",
      examples: ["add this email to calendar", "make a calendar event from this", "schedule this email", "put this meeting on my calendar"],
      previewIntent: { kind: "create_calendar_event_from_current_email" },
      resolve: () =>
        activeContext?.kind === "email" ? { kind: "create_calendar_event_from_current_email" } : null,
      highThreshold: 0.82,
    },
    {
      id: "builtin.pdf.tasks",
      source: "builtin",
      label: "Create tasks from current PDF",
      examples: ["make tasks from this pdf", "extract tasks from this document", "turn this pdf into tasks", "create homework tasks from this"],
      previewIntent: { kind: "create_tasks_from_current_pdf" },
      resolve: () => (activeContext?.kind === "pdf" ? { kind: "create_tasks_from_current_pdf" } : null),
      highThreshold: 0.82,
    },
    {
      id: "builtin.daily_brief",
      source: "builtin",
      label: "Create daily brief",
      examples: ["make my daily brief", "what should I focus on today", "brief me for today", "morning brief"],
      previewIntent: { kind: "create_daily_brief" },
      resolve: () => ({ kind: "create_daily_brief" }),
    },
  ];

  for (const record of learnedIntentMappings) {
    const intent = decodeLearnedIntent(record);
    if (!intent) {
      continue;
    }

    candidates.push({
      id: `learned.${record.id}`,
      source: "learned",
      label: `Learned: ${describeCommandIntent(intent)}`,
      examples: [record.phrase, describeCommandIntent(intent)],
      previewIntent: intent,
      resolve: () => intent,
      weight: Math.min(0.12, 0.03 + record.useCount * 0.01),
      highThreshold: 0.78,
      mediumThreshold: 0.62,
    });
  }

  for (const workflow of savedWorkflows) {
    candidates.push({
      id: `workflow.${workflow.id}`,
      source: "workflow",
      label: `Workflow: ${workflow.name}`,
      examples: [workflow.triggerPhrase, workflow.name, ...workflow.steps.slice(0, 3)],
      workflow,
      weight: Math.min(0.1, 0.03 + workflow.basedOnCount * 0.01),
      highThreshold: 0.8,
      mediumThreshold: 0.64,
    });
  }

  return candidates;
}

export function getSemanticIntentFeedbackAdjustment(
  command: string,
  candidate: SemanticIntentCandidate,
  feedbackRecords: SemanticIntentFeedbackRecord[],
) {
  let adjustment = 0;
  for (const record of feedbackRecords) {
    if (record.candidateId !== candidate.id) {
      continue;
    }

    const similarity = scoreLearnedPhraseSimilarity(command, record.phrase);
    if (similarity < 0.55) {
      continue;
    }

    adjustment += record.accepted ? similarity * 0.05 : -similarity * 0.12;
  }

  return Math.max(-0.22, Math.min(0.12, adjustment));
}

export async function rankSemanticIntentCandidates(
  command: string,
  candidates: SemanticIntentCandidate[],
  commandEmbedding: number[],
  buildEmbedding: (text: string) => Promise<{ embedding: number[]; backend: EmbeddingBackend }>,
  feedbackRecords: SemanticIntentFeedbackRecord[] = [],
) {
  const ranks: SemanticIntentRank[] = [];

  for (const candidate of candidates) {
    let bestScore = 0;
    let matchedExample = candidate.examples[0] ?? candidate.label;
    const examples = [candidate.label, ...candidate.examples].filter(Boolean);
    const feedbackAdjustment = getSemanticIntentFeedbackAdjustment(
      command,
      candidate,
      feedbackRecords,
    );

    for (const example of examples) {
      const exampleEmbedding = await buildEmbedding(example);
      const semanticScore = cosineSimilarity(commandEmbedding, exampleEmbedding.embedding);
      const lexicalScore = scoreLearnedPhraseSimilarity(command, example);
      const score = Math.min(
        1,
        Math.max(0, Math.max(semanticScore, lexicalScore * 0.92) + (candidate.weight ?? 0) + feedbackAdjustment),
      );
      if (score > bestScore) {
        bestScore = score;
        matchedExample = example;
      }
    }

    const highThreshold = candidate.highThreshold ?? 0.84;
    const mediumThreshold = candidate.mediumThreshold ?? 0.68;
    if (bestScore >= mediumThreshold) {
      ranks.push({
        candidate,
        score: bestScore,
        confidence: bestScore >= highThreshold ? "high" : "medium",
        matchedExample,
      });
    }
  }

  return ranks.sort((left, right) => right.score - left.score);
}

export function resolveNaturalConversationFollowUp(
  command: string,
  activeContext: ActiveConversationContext | null,
  semanticMemory: SemanticConversationMemoryRecord[],
  queryEmbedding?: number[],
): NaturalConversationResolution | null {
  const normalized = normalizeControlCommand(command);
  const relevant = findRelevantConversationMemory(command, semanticMemory, queryEmbedding);

  if (
    [
      "what were we doing",
      "what was i doing",
      "what is the current topic",
      "what are we working on",
      "what were we talking about",
    ].includes(normalized)
  ) {
    const topic = activeContext?.label ?? relevant?.record.contextLabel ?? relevant?.record.summary ?? "nothing specific yet";
    return {
      kind: "reply",
      title: "Current topic",
      detail: `Current topic: ${topic}.`,
      spoken: `We are on ${topic}.`,
    };
  }

  if (
    ["what can i do with this", "what can we do with this", "what next", "what should i do next"].includes(
      normalized,
    )
  ) {
    const contextLabel = activeContext?.label ?? relevant?.record.contextLabel;
    const suggestion =
      activeContext?.kind === "pdf"
        ? "You can ask me to summarize it, read it, save its summary to Notion, or make tasks from it."
        : activeContext?.kind === "email"
        ? "You can ask me to read it, save it to Notion, extract details, or add it to Calendar."
        : activeContext?.kind === "task"
        ? "You can ask me to complete it, move it to today or tomorrow, or reopen it."
        : activeContext?.kind === "note"
        ? "You can ask me to read it or open it."
        : relevant
        ? `This seems related to ${relevant.record.summary}. You can continue that topic or teach me a next step.`
        : "I need one active topic first. Open an email, PDF, task, note, app, or workspace, then I can keep going with it.";

    return {
      kind: "reply",
      title: "Possible next steps",
      detail: contextLabel ? `${contextLabel}: ${suggestion}` : suggestion,
      spoken: suggestion,
    };
  }

  if (["continue", "keep going", "continue that", "continue with that"].includes(normalized)) {
    if (activeContext?.kind === "pdf") {
      return { kind: "intent", intent: { kind: "summarize_current_pdf" } };
    }
    if (activeContext?.kind === "email") {
      return { kind: "intent", intent: { kind: "extract_current_email_signals" } };
    }
    if (activeContext?.kind === "task") {
      return {
        kind: "reply",
        title: "Current task",
        detail: `The active task is ${activeContext.label}. You can complete it, move it, or reopen it.`,
        spoken: `The active task is ${activeContext.label}.`,
      };
    }

    if (relevant) {
      return {
        kind: "reply",
        title: "Related memory",
        detail: `This sounds related to: ${relevant.record.summary}. Tell me the next action and I will keep that topic in mind.`,
        spoken: `This sounds related to ${relevant.record.summary}.`,
      };
    }
  }

  if (relevant && /^(that|this|it)\b/i.test(normalized)) {
    return {
      kind: "reply",
      title: "Semantic memory match",
      detail: `I think this relates to "${relevant.record.summary}" (${Math.round(relevant.score * 100)}% semantic match). Tell me the action, like "save it", "open it", or "make tasks".`,
      spoken: `I think this relates to ${relevant.record.summary}. What should I do with it?`,
    };
  }

  return null;
}

export function parseTeachingInstruction(
  command: string,
  fallbackPhrase: string | null,
): TeachingInstruction | null {
  const trimmed = command.trim();
  const directWorkflowTeachMatch = trimmed.match(
    /^when i say\s+(.+?)[,\s]+(?:do\s+|run\s+)?((?:open|read|show|save|add|search|find|make|create|complete|reopen|move|summarize|analyze|extract|play|pause|launch|check|list|filter)\b.+)$/i,
  );
  if (directWorkflowTeachMatch?.[1]?.trim() && directWorkflowTeachMatch?.[2]?.trim()) {
    const phrase = directWorkflowTeachMatch[1].trim().replace(/^["']|["']$/g, "");
    const workflowSteps = splitWorkflowCommand(directWorkflowTeachMatch[2].trim());
    if (workflowSteps) {
      return { kind: "teach_workflow", phrase, steps: workflowSteps };
    }
  }

  const directTeachMatch = trimmed.match(
    /^(?:when i say|remember that|teach(?: jarvis)? that)\s+(.+?)\s+(?:means|goes to|should mean)\s+(.+)$/i,
  );
  if (directTeachMatch?.[1]?.trim() && directTeachMatch?.[2]?.trim()) {
    const phrase = directTeachMatch[1].trim().replace(/^["']|["']$/g, "");
    const meaning = directTeachMatch[2].trim().replace(/^["']|["']$/g, "");
    const workflowSteps = splitWorkflowCommand(meaning);

    if (workflowSteps) {
      return { kind: "teach_workflow", phrase, steps: workflowSteps };
    }

    if (/^(spotify)$/i.test(meaning) && /\bmusic\b/i.test(phrase)) {
      return { kind: "set_music_provider", provider: "spotify" };
    }

    if (/^(notion)$/i.test(meaning) && /\b(notes?|note taking)\b/i.test(phrase)) {
      return { kind: "set_note_app", app: "notion" };
    }

    return { kind: "teach_phrase", phrase, meaning };
  }

  if (fallbackPhrase) {
    const fallbackMeaningMatch = trimmed.match(/^(?:that|this|it)\s+means\s+(.+)$/i);
    if (fallbackMeaningMatch?.[1]?.trim()) {
      const meaning = fallbackMeaningMatch[1].trim();
      const workflowSteps = splitWorkflowCommand(meaning);
      if (workflowSteps) {
        return {
          kind: "teach_workflow",
          phrase: fallbackPhrase,
          steps: workflowSteps,
        };
      }

      return {
        kind: "teach_phrase",
        phrase: fallbackPhrase,
        meaning,
      };
    }
  }

  const musicProviderMatch = trimmed.match(
    /^(?:remember that|use|set)\s+(?:music|songs?)\s+(?:means|to|as)\s+spotify$/i,
  );
  if (musicProviderMatch) {
    return { kind: "set_music_provider", provider: "spotify" };
  }

  const noteAppMatch = trimmed.match(
    /^(?:remember that|use|set)\s+(?:notes?|note taking)\s+(?:go to|to|as)\s+notion$/i,
  );
  if (noteAppMatch) {
    return { kind: "set_note_app", app: "notion" };
  }

  const defaultWorkspaceMatch = trimmed.match(
    /^(?:remember that setup means|use|set)\s+(.+?)\s+(?:as my )?default workspace$/i,
  );
  if (defaultWorkspaceMatch?.[1]?.trim()) {
    return {
      kind: "set_default_workspace",
      workspaceName: normalizeDesktopProjectName(defaultWorkspaceMatch[1].trim()),
    };
  }

  const setupWorkspaceMatch = trimmed.match(
    /^(?:remember that setup means|remember that my setup means)\s+open\s+(.+?)\s+workspace$/i,
  );
  if (setupWorkspaceMatch?.[1]?.trim()) {
    return {
      kind: "set_default_workspace",
      workspaceName: normalizeDesktopProjectName(setupWorkspaceMatch[1].trim()),
    };
  }

  return null;
}

export function parseCorrectionInstruction(command: string): CorrectionInstruction | null {
  const trimmed = command.trim();
  const correctionMatch = trimmed.match(
    /^(?:no[, ]+)?(?:i meant|i mean|that should be|that means|actually|no actually|not that[, ]+i meant)\s+(.+)$/i,
  );
  const meaning = correctionMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!meaning) {
    return null;
  }

  const workflowSteps = splitWorkflowCommand(meaning);
  if (workflowSteps) {
    return { kind: "correct_workflow", steps: workflowSteps };
  }

  return { kind: "correct_phrase", meaning };
}

export function isExplainIntentRoutingCommand(command: string) {
  return [
    "why did you choose that",
    "why did you pick that",
    "why did you do that",
    "explain your thinking",
    "explain your match",
    "explain that match",
    "why that intent",
    "why that command",
    "what did you match",
    "show your thinking",
  ].includes(normalizeControlCommand(command));
}

export function parseSemanticIntentTestCommand(command: string) {
  const match = command.trim().match(
    /^(?:test intent(?: for)?|test semantic(?: match)?(?: for)?|debug intent(?: for)?|what would you do with)\s+(.+)$/i,
  );
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") || null;
}

export function isStartTrainingModeCommand(command: string) {
  return [
    "start training mode",
    "start language training",
    "train jarvis",
    "teach jarvis mode",
    "start teaching mode",
    "start phrase training",
  ].includes(normalizeControlCommand(command));
}

export function isCancelTrainingModeCommand(command: string) {
  return [
    "cancel training",
    "stop training",
    "exit training mode",
    "quit training mode",
    "end training mode",
  ].includes(normalizeControlCommand(command));
}

export function parseTrainingReviewCleanupCommand(command: string) {
  const trimmed = command.trim();
  const deletePhraseMatch = trimmed.match(
    /^(?:delete|remove|forget)\s+(?:the\s+)?(?:learned\s+)?phrase\s+["']?(.+?)["']?$/i,
  );
  if (deletePhraseMatch?.[1]?.trim()) {
    return {
      kind: "delete_phrase" as const,
      phrase: deletePhraseMatch[1].trim(),
    };
  }

  const renamePhraseMatch = trimmed.match(
    /^(?:rename|change)\s+(?:the\s+)?(?:learned\s+)?phrase\s+["']?(.+?)["']?\s+to\s+["']?(.+?)["']?$/i,
  );
  if (renamePhraseMatch?.[1]?.trim() && renamePhraseMatch?.[2]?.trim()) {
    return {
      kind: "rename_phrase" as const,
      phrase: renamePhraseMatch[1].trim(),
      nextPhrase: renamePhraseMatch[2].trim(),
    };
  }

  const deleteWorkflowMatch = trimmed.match(
    /^(?:delete|remove|forget)\s+(?:the\s+)?(?:saved\s+)?workflow\s+["']?(.+?)["']?$/i,
  );
  if (deleteWorkflowMatch?.[1]?.trim()) {
    return {
      kind: "delete_workflow" as const,
      phrase: deleteWorkflowMatch[1].trim(),
    };
  }

  const renameWorkflowMatch = trimmed.match(
    /^(?:rename|change)\s+(?:the\s+)?(?:workflow\s+)?trigger\s+["']?(.+?)["']?\s+to\s+["']?(.+?)["']?$/i,
  );
  if (renameWorkflowMatch?.[1]?.trim() && renameWorkflowMatch?.[2]?.trim()) {
    return {
      kind: "rename_workflow" as const,
      phrase: renameWorkflowMatch[1].trim(),
      nextPhrase: renameWorkflowMatch[2].trim(),
    };
  }

  return null;
}

export function isSameTopicFollowUpCommand(command: string) {
  return [
    "do the same",
    "do the same thing",
    "same for this",
    "do the same for this",
    "do that for this",
    "what about this",
    "what about that one",
    "do it for this one",
    "do it for that one",
  ].includes(normalizeControlCommand(command));
}

export function resolveSameTopicFollowUpIntent(
  command: string,
  lastTopic: ConversationTopicRecord | null,
  activeContext: ActiveConversationContext | null,
): CommandIntent | null {
  if (!lastTopic || !isSameTopicFollowUpCommand(command)) {
    return null;
  }

  if (lastTopic.actionType === "save") {
    if (activeContext?.kind === "email") return { kind: "save_current_email_to_notion" };
    if (activeContext?.kind === "pdf") return { kind: "save_current_pdf_summary_to_notion" };
    if (activeContext?.kind === "screenshot") return { kind: "save_last_screenshot_to_notion" };
  }

  if (lastTopic.actionType === "create") {
    if (activeContext?.kind === "pdf") return { kind: "create_tasks_from_current_pdf" };
    if (activeContext?.kind === "email") return { kind: "create_calendar_event_from_current_email" };
  }

  if (lastTopic.actionType === "open") {
    if (activeContext?.kind === "email") return { kind: "open_current_email" };
    if (activeContext?.kind === "pdf") return { kind: "open_current_pdf" };
    if (activeContext?.kind === "note") return { kind: "open_current_note" };
    if (activeContext?.kind === "browser") return { kind: "open_current_browser_target" };
    if (activeContext?.kind === "desktop_workspace") {
      return { kind: "open_desktop_project", query: activeContext.projectName };
    }
  }

  if (lastTopic.actionType === "play" && activeContext?.kind === "browser") {
    return { kind: "spotify_play" };
  }

  return null;
}

export function requiresSemanticConfirmation(intent: CommandIntent) {
  return [
    "delete_desktop_project",
    "control_desktop_app_window",
    "run_project_checks",
    "create_builder_handoff",
    "shutdown_app",
    "save_current_email_to_notion",
    "save_email_digest_to_notion",
    "save_first_emails_to_notion",
    "save_current_email_travel_to_notion",
    "save_current_email_expense_to_notion",
    "save_current_email_package_to_notion",
    "save_current_pdf_summary_to_notion",
    "save_screen_text_to_notion",
    "create_calendar_event",
    "create_calendar_event_from_current_email",
    "create_reminder",
    "complete_all_overdue_tasks",
  ].includes(intent.kind);
}

export function isSpotifyConversationContext(
  activeContext: ActiveConversationContext | null,
  lastTopic: ConversationTopicRecord | null,
  musicProvider: UserPreferenceMemory["musicProvider"],
) {
  if (musicProvider === "spotify" && lastTopic?.actionType === "play") {
    return true;
  }

  if (
    lastTopic?.intentLabel.toLowerCase().includes("spotify") ||
    lastTopic?.contextLabel?.toLowerCase().includes("spotify")
  ) {
    return true;
  }

  if (!activeContext) {
    return false;
  }

  if (activeContext.kind === "browser") {
    return activeContext.url.toLowerCase().includes("spotify.com") || activeContext.label.toLowerCase().includes("spotify");
  }

  if (activeContext.kind === "desktop_app") {
    return activeContext.appName.toLowerCase().includes("spotify");
  }

  return activeContext.label.toLowerCase().includes("spotify");
}

export function getConversationContextKey(context: ActiveConversationContext) {
  switch (context.kind) {
    case "email":
      return `email:${context.emailId}`;
    case "pdf":
      return `pdf:${context.path}`;
    case "note":
      return `note:${context.noteId}`;
    case "task":
      return `task:${context.noteId}`;
    case "browser":
      return `browser:${canonicalizeBrowserUrl(context.url)}`;
    case "desktop_app":
      return `desktop_app:${normalizeControlCommand(context.appName)}`;
    case "desktop_folder":
      return `desktop_folder:${normalizeControlCommand(context.folderName)}`;
    case "desktop_workspace":
      return `desktop_workspace:${normalizeControlCommand(context.projectName)}`;
    case "screenshot":
      return `screenshot:${context.path}`;
    default:
      return "unknown";
  }
}

export function findConversationContextByLabel(
  query: string,
  stack: ConversationContextStackEntry[],
) {
  const normalizedQuery = normalizeControlCommand(query);
  if (!normalizedQuery) {
    return null;
  }

  return (
    stack.find((entry) => normalizeControlCommand(entry.label) === normalizedQuery) ??
    stack.find((entry) => normalizeControlCommand(entry.label).includes(normalizedQuery)) ??
    null
  );
}

export function resolveSpotifyContextFollowUpIntent(
  command: string,
  activeContext: ActiveConversationContext | null,
  lastTopic: ConversationTopicRecord | null,
  musicProvider: UserPreferenceMemory["musicProvider"],
): CommandIntent | null {
  if (!isSpotifyConversationContext(activeContext, lastTopic, musicProvider)) {
    return null;
  }

  if (hasExplicitSearchLanguage(command) && /\bgoogle\b/i.test(command)) {
    return null;
  }

  const cleaned = cleanConversationalCommand(command).replace(/[?.!]+$/g, "").trim();
  const normalized = normalizeControlCommand(cleaned);

  if (["pause", "pause it", "pause music", "stop music"].includes(normalized)) {
    return { kind: "spotify_pause" };
  }

  if (["resume", "resume it", "play", "play it", "continue music"].includes(normalized)) {
    return { kind: "spotify_play" };
  }

  if (["next", "next song", "skip", "skip song", "skip track"].includes(normalized)) {
    return { kind: "spotify_next" };
  }

  if (["previous", "previous song", "last song", "go back"].includes(normalized)) {
    return { kind: "spotify_previous" };
  }

  if (["like this", "like this song", "save this", "save this song"].includes(normalized)) {
    return { kind: "spotify_like_current" };
  }

  const queueMatch = cleaned.match(/^(?:queue|add|put)\s+(.+?)(?:\s+(?:next|to queue|in queue))?$/i);
  if (queueMatch?.[1]?.trim()) {
    return { kind: "spotify_queue_query", query: queueMatch[1].trim() };
  }

  const playMatch = cleaned.match(/^(?:play|put on|start|listen to)\s+(.+)$/i);
  if (playMatch?.[1]?.trim()) {
    return { kind: "spotify_play_query", query: playMatch[1].trim() };
  }

  const searchMatch = cleaned.match(/^(?:search|find)\s+(.+)$/i);
  if (searchMatch?.[1]?.trim()) {
    return { kind: "spotify_play_query", query: searchMatch[1].trim() };
  }

  return null;
}

export function resolveActiveAppContextFollowUpIntent(
  command: string,
  activeContext: ActiveConversationContext | null,
  lastTopic: ConversationTopicRecord | null,
  musicProvider: UserPreferenceMemory["musicProvider"],
): CommandIntent | null {
  const spotifyIntent = resolveSpotifyContextFollowUpIntent(
    command,
    activeContext,
    lastTopic,
    musicProvider,
  );
  if (spotifyIntent) {
    return spotifyIntent;
  }

  if (!activeContext) {
    return null;
  }

  const cleaned = cleanConversationalCommand(command).replace(/[?.!]+$/g, "").trim();
  const normalized = normalizeControlCommand(cleaned);

  if (activeContext.kind === "browser" && activeContext.label.toLowerCase().includes("gmail")) {
    if (["check it", "read it", "read this", "show unread", "show unread emails"].includes(normalized)) {
      return { kind: "list_unread_emails" };
    }
    const searchMatch = cleaned.match(/^(?:search|find)\s+(.+)$/i);
    if (searchMatch?.[1]?.trim()) {
      return { kind: "search_emails", query: searchMatch[1].trim() };
    }
  }

  if (activeContext.kind === "browser" && activeContext.label.toLowerCase().includes("notion")) {
    const noteMatch = cleaned.match(/^(?:save|write|make|create|add|note)\s+(.+)$/i);
    if (noteMatch?.[1]?.trim()) {
      return { kind: "create_note", content: noteMatch[1].trim() };
    }
    if (["show notes", "list notes", "open notes"].includes(normalized)) {
      return { kind: "list_notes" };
    }
  }

  if (activeContext.kind === "browser" && activeContext.label.toLowerCase().includes("calendar")) {
    const eventIntent = parseCalendarCommandIntent(cleaned);
    if (eventIntent) {
      return eventIntent;
    }
  }

  if (activeContext.kind === "desktop_workspace") {
    if (["open this", "open it", "start this", "start it", "launch it"].includes(normalized)) {
      return { kind: "open_desktop_project", query: activeContext.projectName };
    }
    const duration = parseDurationMinutesFromText(cleaned);
    if (duration && /\b(start|work|focus|run)\b/i.test(cleaned)) {
      return {
        kind: "start_desktop_project_for_duration",
        query: activeContext.projectName,
        durationMinutes: duration,
      };
    }
  }

  return null;
}

export function resolveContextualFollowUpIntent(
  command: string,
  activeContext: ActiveConversationContext | null,
): CommandIntent | null {
  if (!activeContext) {
    return null;
  }

  const normalized = normalizeControlCommand(command)
    .replace(/^(?:also|then|now|next|after that|and then)\s+/i, "")
    .replace(/^(?:can you|could you|would you|please)\s+/i, "")
    .trim();

  if (activeContext.kind === "email") {
    if (["save it to notion", "save that to notion", "save it as a note", "save it", "save that"].includes(normalized)) {
      return { kind: "save_current_email_to_notion" };
    }

    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_email" };
    }

    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_email" };
    }

    if (
      [
        "analyze it",
        "analyze that",
        "extract details from it",
        "extract details from that",
      ].includes(normalized)
    ) {
      return { kind: "extract_current_email_signals" };
    }

    if (
      [
        "add it to calendar",
        "turn it into a calendar event",
        "make a calendar event from it",
      ].includes(normalized)
    ) {
      return { kind: "create_calendar_event_from_current_email" };
    }
  }

  if (activeContext.kind === "pdf") {
    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_pdf" };
    }

    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_pdf" };
    }

    if (["summarize it", "summarize that", "summarize it first", "continue", "keep going"].includes(normalized)) {
      return { kind: "summarize_current_pdf" };
    }

    if (["save it to notion", "save that to notion", "save its summary to notion", "save it", "save that"].includes(normalized)) {
      return { kind: "save_current_pdf_summary_to_notion" };
    }

    if (["make tasks from it", "create tasks from it", "make tasks from that", "make tasks", "create tasks"].includes(normalized)) {
      return { kind: "create_tasks_from_current_pdf" };
    }
  }

  if (activeContext.kind === "note") {
    if (["read it", "show it", "read that", "show that"].includes(normalized)) {
      return { kind: "read_current_note" };
    }

    if (["open it", "open that"].includes(normalized)) {
      return { kind: "open_current_note" };
    }
  }

  if (activeContext.kind === "task") {
    if (["complete it", "complete that", "mark it done", "mark that done"].includes(normalized)) {
      return { kind: "complete_current_task" };
    }

    if (["reopen it", "reopen that"].includes(normalized)) {
      return { kind: "reopen_current_task" };
    }

    if (["move it to today", "move that to today"].includes(normalized)) {
      return { kind: "move_current_task", dueLabel: "today" };
    }

    if (["move it to tomorrow", "move that to tomorrow"].includes(normalized)) {
      return { kind: "move_current_task", dueLabel: "tomorrow" };
    }
  }

  if (activeContext.kind === "browser") {
    if (["open it", "open it again", "open that", "open that again"].includes(normalized)) {
      return { kind: "open_current_browser_target" };
    }
  }

  if (activeContext.kind === "desktop_workspace") {
    if (["open it", "open that", "open it again", "start it", "start that"].includes(normalized)) {
      return { kind: "open_desktop_project", query: activeContext.projectName };
    }
  }

  return null;
}

export function resolveOrdinalIndex(command: string) {
  const normalized = normalizeControlCommand(command);
  if (normalized.includes("first one")) {
    return 1;
  }

  if (normalized.includes("second one")) {
    return 2;
  }

  if (normalized.includes("third one")) {
    return 3;
  }

  return null;
}

export function resolveOrdinalFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const index = resolveOrdinalIndex(command);
  if (!index) {
    return null;
  }

  const normalized = normalizeControlCommand(command);

  if (collection.kind === "emails") {
    const emailId = collection.emailIds[index - 1];
    const resolvedIndex = emailId
      ? emails.findIndex((email) => email.id === emailId) + 1
      : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save the")) {
      return { kind: "save_email_to_notion_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("analyze the") || normalized.startsWith("extract details from the")) {
      return { kind: "extract_email_signals", index: resolvedIndex };
    }

    if (normalized.startsWith("add the")) {
      return { kind: "create_calendar_event_from_email", index: resolvedIndex };
    }
  }

  if (collection.kind === "pdfs") {
    const path = collection.paths[index - 1];
    const resolvedIndex = path ? getLoadedPdfFiles(files).findIndex((file) => file.path === path) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("summarize the")) {
      return { kind: "summarize_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save the")) {
      return { kind: "save_pdf_summary_to_notion_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("make tasks from the") || normalized.startsWith("create tasks from the")) {
      return { kind: "create_tasks_from_pdf_by_index", index: resolvedIndex };
    }
  }

  if (collection.kind === "notes") {
    const noteId = collection.noteIds[index - 1];
    const resolvedIndex = noteId ? notes.findIndex((note) => note.id === noteId) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("open the")) {
      return { kind: "open_note_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read the") || normalized.startsWith("show the")) {
      return { kind: "read_note_by_index", index: resolvedIndex };
    }
  }

  if (collection.kind === "tasks") {
    const noteId = collection.noteIds[index - 1];
    const resolvedIndex = noteId ? tasks.findIndex((task) => task.id === noteId) + 1 : 0;
    if (resolvedIndex < 1) {
      return null;
    }

    if (normalized.startsWith("complete the")) {
      return { kind: "complete_task_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("reopen the")) {
      return { kind: "reopen_task_by_index", index: resolvedIndex };
    }

    if (normalized === "move the first one to today" || normalized === "move the second one to today" || normalized === "move the third one to today") {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "today" };
    }

    if (normalized === "move the first one to tomorrow" || normalized === "move the second one to tomorrow" || normalized === "move the third one to tomorrow") {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "tomorrow" };
    }
  }

  return null;
}

export function resolveReferenceQuery(command: string) {
  const trimmed = cleanConversationalCommand(command);
  const match = trimmed.match(
    /^(?:open|read|show|save|analyze|extract details from|add|summarize|make tasks from|create tasks from|complete|reopen|move)\s+(?:the\s+)?(?:email|pdf|note|task|one)\s+(?:about|called|named)\s+(.+)$/i,
  );
  return match?.[1]?.trim() ?? null;
}

export function getPresentedCollectionSize(collection: PresentedCollectionContext | null) {
  if (!collection) {
    return 0;
  }

  if (collection.kind === "emails") {
    return collection.emailIds.length;
  }

  if (collection.kind === "pdfs") {
    return collection.paths.length;
  }

  return collection.noteIds.length;
}

export function mapCollectionIntent(
  kind: PresentedCollectionContext["kind"],
  normalized: string,
  resolvedIndex: number,
): CommandIntent | null {
  if (kind === "emails") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_email_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save ")) {
      return { kind: "save_email_to_notion_by_index", index: resolvedIndex };
    }

    if (
      normalized.startsWith("analyze ") ||
      normalized.startsWith("extract details from ")
    ) {
      return { kind: "extract_email_signals", index: resolvedIndex };
    }

    if (normalized.startsWith("add ")) {
      return { kind: "create_calendar_event_from_email", index: resolvedIndex };
    }
  }

  if (kind === "pdfs") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("summarize ")) {
      return { kind: "summarize_pdf_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("save ")) {
      return { kind: "save_pdf_summary_to_notion_by_index", index: resolvedIndex };
    }

    if (
      normalized.startsWith("make tasks from ") ||
      normalized.startsWith("create tasks from ")
    ) {
      return { kind: "create_tasks_from_pdf_by_index", index: resolvedIndex };
    }
  }

  if (kind === "notes") {
    if (normalized.startsWith("open ")) {
      return { kind: "open_note_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("read ") || normalized.startsWith("show ")) {
      return { kind: "read_note_by_index", index: resolvedIndex };
    }
  }

  if (kind === "tasks") {
    if (normalized.startsWith("complete ")) {
      return { kind: "complete_task_by_index", index: resolvedIndex };
    }

    if (normalized.startsWith("reopen ")) {
      return { kind: "reopen_task_by_index", index: resolvedIndex };
    }

    if (normalized.includes(" to today")) {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "today" };
    }

    if (normalized.includes(" to tomorrow")) {
      return { kind: "move_task_by_index", index: resolvedIndex, dueLabel: "tomorrow" };
    }
  }

  return null;
}

export function getActivePresentedCollectionIndex(
  collection: PresentedCollectionContext,
  activeContext: ActiveConversationContext | null,
) {
  if (collection.kind === "emails") {
    const activeId = activeContext?.kind === "email" ? activeContext.emailId : null;
    return activeId ? collection.emailIds.findIndex((id) => id === activeId) + 1 : 0;
  }

  if (collection.kind === "pdfs") {
    const activePath = activeContext?.kind === "pdf" ? activeContext.path : null;
    return activePath ? collection.paths.findIndex((path) => path === activePath) + 1 : 0;
  }

  if (collection.kind === "notes") {
    const activeId = activeContext?.kind === "note" ? activeContext.noteId : null;
    return activeId ? collection.noteIds.findIndex((id) => id === activeId) + 1 : 0;
  }

  const activeId = activeContext?.kind === "task" ? activeContext.noteId : null;
  return activeId ? collection.noteIds.findIndex((id) => id === activeId) + 1 : 0;
}

export function resolveCollectionPositions(
  collection: PresentedCollectionContext,
  activeContext: ActiveConversationContext | null,
  mode: "first" | "next" | "rest",
  count: number | null,
) {
  const size = getPresentedCollectionSize(collection);
  if (size < 1) {
    return [];
  }

  if (mode === "first") {
    const limitedCount = Math.max(1, Math.min(count ?? 1, size));
    return Array.from({ length: limitedCount }, (_, offset) => offset + 1);
  }

  const activeIndex = getActivePresentedCollectionIndex(collection, activeContext);
  const startIndex = activeIndex > 0 ? activeIndex + 1 : 1;
  if (startIndex > size) {
    return [];
  }

  if (mode === "next") {
    const limitedCount = Math.max(1, Math.min(count ?? 1, size - startIndex + 1));
    return Array.from({ length: limitedCount }, (_, offset) => startIndex + offset);
  }

  return Array.from({ length: size - startIndex + 1 }, (_, offset) => startIndex + offset);
}

export function resolveCollectionGlobalIndices(
  collection: PresentedCollectionContext,
  positions: number[],
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  if (positions.length === 0) {
    return [];
  }

  if (collection.kind === "emails") {
    return positions
      .map((position) => collection.emailIds[position - 1])
      .map((emailId) => (emailId ? emails.findIndex((email) => email.id === emailId) + 1 : 0))
      .filter((index) => index > 0);
  }

  if (collection.kind === "pdfs") {
    const loadedPdfs = getLoadedPdfFiles(files);
    return positions
      .map((position) => collection.paths[position - 1])
      .map((path) => (path ? loadedPdfs.findIndex((file) => file.path === path) + 1 : 0))
      .filter((index) => index > 0);
  }

  if (collection.kind === "notes") {
    return positions
      .map((position) => collection.noteIds[position - 1])
      .map((noteId) => (noteId ? notes.findIndex((note) => note.id === noteId) + 1 : 0))
      .filter((index) => index > 0);
  }

  return positions
    .map((position) => collection.noteIds[position - 1])
    .map((noteId) => (noteId ? tasks.findIndex((task) => task.id === noteId) + 1 : 0))
    .filter((index) => index > 0);
}

export function resolveBatchReferenceFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const normalized = normalizeControlCommand(command);
  const firstMatch = normalized.match(/\bfirst (\d+)(?: of (?:those|them))?\b/);
  const nextMatch = normalized.match(/\bnext (\d+)(?: of (?:those|them))?\b/);
  const wantsRest = /\b(?:the )?rest(?: of (?:those|them))?\b/.test(normalized);

  let mode: "first" | "next" | "rest" | null = null;
  let count: number | null = null;

  if (firstMatch) {
    mode = "first";
    count = Number(firstMatch[1]);
  } else if (nextMatch) {
    mode = "next";
    count = Number(nextMatch[1]);
  } else if (wantsRest) {
    mode = "rest";
  }

  if (!mode) {
    return null;
  }

  const positions = resolveCollectionPositions(collection, activeContext, mode, count);
  const indices = resolveCollectionGlobalIndices(collection, positions, emails, files, notes, tasks);
  if (indices.length === 0) {
    return null;
  }

  if (collection.kind === "emails") {
    if (normalized.startsWith("save ")) {
      return { kind: "save_email_range_to_notion", indices };
    }
    return null;
  }

  if (collection.kind === "pdfs") {
    if (normalized.startsWith("summarize ")) {
      return { kind: "summarize_pdf_range", indices };
    }
    return null;
  }

  if (collection.kind === "tasks") {
    if (normalized.startsWith("complete ")) {
      return { kind: "complete_task_range", indices };
    }
    return null;
  }

  return null;
}

export function resolveReferenceFollowUpIntent(
  command: string,
  collection: PresentedCollectionContext | null,
  activeContext: ActiveConversationContext | null,
  emails: EmailRecord[],
  files: FileRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
): CommandIntent | null {
  if (!collection) {
    return null;
  }

  const normalized = normalizeControlCommand(command);
  let resolvedIndex = 0;

  if (/\b(last one|last email|last pdf|last note|last task)\b/.test(normalized)) {
    resolvedIndex = getPresentedCollectionSize(collection);
  } else if (/\b(other one|other email|other pdf|other note|other task)\b/.test(normalized)) {
    if (collection.kind === "emails") {
      const activeId = activeContext?.kind === "email" ? activeContext.emailId : null;
      const activeIndex = activeId ? collection.emailIds.findIndex((id) => id === activeId) : -1;
      resolvedIndex =
        activeIndex === 0 && collection.emailIds.length > 1
          ? 2
          : collection.emailIds.length > 0
            ? 1
            : 0;
    } else if (collection.kind === "pdfs") {
      const activePath = activeContext?.kind === "pdf" ? activeContext.path : null;
      const activeIndex = activePath ? collection.paths.findIndex((path) => path === activePath) : -1;
      resolvedIndex =
        activeIndex === 0 && collection.paths.length > 1
          ? 2
          : collection.paths.length > 0
            ? 1
            : 0;
    } else {
      const activeId =
        activeContext?.kind === "note" || activeContext?.kind === "task"
          ? activeContext.noteId
          : null;
      const ids = collection.noteIds;
      const activeIndex = activeId ? ids.findIndex((id) => id === activeId) : -1;
      resolvedIndex = activeIndex === 0 && ids.length > 1 ? 2 : ids.length > 0 ? 1 : 0;
    }
  } else {
    const query = resolveReferenceQuery(command);
    if (!query) {
      return null;
    }

    if (collection.kind === "emails") {
      const matched = collection.emailIds.find((emailId) => {
        const email = emails.find((entry) => entry.id === emailId);
        if (!email) {
          return false;
        }

        return `${email.subject} ${email.from} ${email.snippet}`.toLowerCase().includes(query.toLowerCase());
      });
      resolvedIndex = matched ? emails.findIndex((entry) => entry.id === matched) + 1 : 0;
    } else if (collection.kind === "pdfs") {
      const matched = collection.paths.find((path) => {
        const file = getLoadedPdfFiles(files).find((entry) => entry.path === path);
        return file ? file.name.toLowerCase().includes(query.toLowerCase()) : false;
      });
      resolvedIndex = matched
        ? getLoadedPdfFiles(files).findIndex((entry) => entry.path === matched) + 1
        : 0;
    } else if (collection.kind === "notes") {
      const matched = collection.noteIds.find((noteId) => {
        const note = notes.find((entry) => entry.id === noteId);
        return note ? `${note.title} ${note.summary}`.toLowerCase().includes(query.toLowerCase()) : false;
      });
      resolvedIndex = matched ? notes.findIndex((entry) => entry.id === matched) + 1 : 0;
    } else if (collection.kind === "tasks") {
      const matched = collection.noteIds.find((noteId) => {
        const task = tasks.find((entry) => entry.id === noteId);
        return task
          ? `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(query.toLowerCase())
          : false;
      });
      resolvedIndex = matched ? tasks.findIndex((entry) => entry.id === matched) + 1 : 0;
    }
  }

  if (resolvedIndex < 1) {
    return null;
  }

  return mapCollectionIntent(collection.kind, normalized, resolvedIndex);
}

export function normalizeUrlTarget(value: string) {
  const normalized = value.trim().toLowerCase();
  if (builtInBrowserAliases[normalized]) {
    return builtInBrowserAliases[normalized];
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.includes(".")) {
    return `https://${value}`;
  }

  return `https://${value}.com`;
}

export function buildSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}`;
}

export function canonicalizeBrowserUrl(value: string) {
  try {
    const parsed = new URL(normalizeUrlTarget(value));
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname || "/";
    const canonicalRoot = canonicalHostRoots[hostname];
    const isKnownHomePath =
      pathname === "/" ||
      pathname === "/home" ||
      pathname === "/feed" ||
      pathname === "/mail" ||
      pathname === "/inbox";

    const paramsToDrop = [
      "fbclid",
      "gclid",
      "feature",
      "mc_cid",
      "mc_eid",
      "si",
      "ref",
      "source",
      "sourceid",
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
      "ved",
      "zx",
    ];

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || paramsToDrop.includes(key)) {
        parsed.searchParams.delete(key);
      }
    }

    if (canonicalRoot && isKnownHomePath) {
      const hasMeaningfulSearch =
        (hostname === "google.com" || hostname === "www.google.com") &&
        parsed.pathname === "/search" &&
        parsed.searchParams.has("q");

      if (!hasMeaningfulSearch) {
        return canonicalRoot;
      }
    }

    parsed.hash = "";

    if (!parsed.search) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return parsed.toString();
  } catch {
    return normalizeUrlTarget(value);
  }
}

export function formatBrowserTargetLabel(url: string) {
  try {
    const parsed = new URL(canonicalizeBrowserUrl(url));
    const hostname = parsed.hostname.toLowerCase();

    const knownLabels: Record<string, string> = {
      "www.google.com": "Google",
      "google.com": "Google",
      "mail.google.com": "Gmail",
      "www.youtube.com": "YouTube",
      "youtube.com": "YouTube",
      "docs.google.com": "Google Docs",
      "calendar.google.com": "Google Calendar",
      "drive.google.com": "Google Drive",
      "github.com": "GitHub",
      "www.github.com": "GitHub",
      "open.spotify.com": "Spotify",
      "spotify.com": "Spotify",
      "www.notion.so": "Notion",
      "notion.so": "Notion",
    };

    if (knownLabels[hostname]) {
      return knownLabels[hostname];
    }

    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function buildStudySetupReply() {
  return "Alright, getting your study setup ready.";
}

export function buildDesktopAppReply(appName: string) {
  return `Yeah, opening ${appName}.`;
}

export function buildDesktopFocusReply(appName: string) {
  return `Yeah, switching to ${appName}.`;
}

export function buildNamedFolderReply(folderName: string) {
  return `Yeah, opening your ${folderName}.`;
}

export function buildScreenshotReply() {
  return "I captured a screenshot.";
}

export function buildScreenshotsFolderReply() {
  return "Yeah, opening your screenshots folder.";
}

export function buildClipboardReadReply(hasText: boolean) {
  return hasText ? "Here is what is on your clipboard." : "Your clipboard looks empty.";
}

export function buildClipboardWriteReply() {
  return "Copied that to your clipboard.";
}

export function buildClipboardOpenReply() {
  return "I opened what was on your clipboard.";
}

export function buildClipboardSearchReply() {
  return "I searched Google for what was on your clipboard.";
}

export function buildClipboardNotionReply(title: string) {
  return `I saved your clipboard to Notion as ${title}.`;
}

export function buildDesktopProjectCreatedReply(name: string) {
  return `I created the ${name} workspace.`;
}

export function buildDesktopProjectOpenedReply(name: string) {
  return `I opened the ${name} workspace.`;
}

export function buildDesktopProjectUpdatedReply(name: string) {
  return `I updated the ${name} workspace.`;
}

export function buildDesktopProjectDeletedReply(name: string) {
  return `I deleted the ${name} workspace.`;
}

export function buildDesktopProjectsListReply(count: number) {
  return count === 0
    ? "You do not have any desktop workspaces saved yet."
    : `I found ${count} saved desktop workspace${count === 1 ? "" : "s"}.`;
}

export function buildWorkspaceScheduledReply(name: string) {
  return `I scheduled the ${name} workspace.`;
}

export function buildScreenshotNotionReply(title: string) {
  return `I saved the screenshot reference to Notion as ${title}.`;
}

export function buildClipboardCleanupReply(mode: "clean" | "summarize" | "format") {
  if (mode === "summarize") {
    return "I summarized your clipboard and copied it back.";
  }
  if (mode === "format") {
    return "I formatted your clipboard and copied it back.";
  }
  return "I cleaned up your clipboard and copied it back.";
}

export function buildProjectChecksReply() {
  return "I ran the JARVIS project checks.";
}

export function createVoiceBuildRequest(request: string): SkillBuildRequest {
  const cleanedRequest = request.trim();
  return {
    skillName: "Voice requested code change",
    title: `Build Request: ${cleanedRequest.slice(0, 80)}`,
    prompt: [
      "Implement the following JARVIS code change request.",
      "",
      `User request: ${cleanedRequest}`,
      "",
      "Requirements:",
      "- Inspect the existing code before editing.",
      "- Preserve unrelated user changes.",
      "- Keep changes scoped to the requested behavior.",
      "- Run TypeScript and Rust checks when relevant.",
      "- Report any manual setup needed.",
    ].join("\n"),
    safetyChecks: [
      "Do not delete or overwrite unrelated files.",
      "Ask for approval before destructive actions.",
      "Keep secrets out of source code.",
      "Verify with project checks before reporting success.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export function buildGoogleSearchReply(query: string) {
  return `Sure, searching Google for ${query}.`;
}

export function buildOpenSiteReply(label: string) {
  return `Yeah, opening ${label}.`;
}

export function buildCreateNoteReply(title: string) {
  return `Alright, I saved that to Notion as ${title}.`;
}

export function buildCreateTaskReply(title: string) {
  return `Alright, I saved that task to Notion as ${title}.`;
}

export function buildListNotesReply(count: number) {
  return count === 0
    ? "I checked Notion, but I did not find any notes yet."
    : `I found ${count} recent Notion notes.`;
}

export function buildSearchNotesReply(query: string, count: number) {
  return count === 0
    ? `I did not find any Notion notes about ${query}.`
    : `I found ${count} Notion notes about ${query}.`;
}

export function buildReadNoteReply(title: string) {
  return `Alright, here is ${title}.`;
}

export function buildOpenNoteReply(title: string) {
  return `Alright, opening ${title} in Notion.`;
}

export function buildTodayTasksReply(count: number) {
  return count === 0
    ? "I did not find any task notes due today in Notion."
    : `I found ${count} task notes due today.`;
}

export function buildUpcomingTasksReply(count: number) {
  return count === 0
    ? "I did not find any upcoming task notes in Notion."
    : `I found ${count} upcoming task notes.`;
}

export function buildOverdueTasksReply(count: number) {
  return count === 0
    ? "I did not find any overdue task notes in Notion."
    : `I found ${count} overdue task notes.`;
}

export function buildCalendarEventReply(title: string) {
  return `Alright, I opened a calendar draft for ${title}.`;
}

export function buildReminderReply(title: string) {
  return `Alright, I opened a reminder draft for ${title}.`;
}

export function buildFileSearchReply(query: string, count: number) {
  return count === 0
    ? `I did not find any files matching ${query}.`
    : `I found ${count} files matching ${query}.`;
}

export function buildRecentFilesReply(count: number) {
  return count === 0
    ? "I could not find any recent files in your Documents folder."
    : `I found ${count} recent files in your Documents folder.`;
}

export function buildOpenFileReply(name: string) {
  return `Alright, opening ${name}.`;
}

export function buildPdfSummaryReply(name: string) {
  return `Alright, I summarized ${name}.`;
}

export function buildPdfTasksReply(name: string, count: number) {
  return `Alright, I created ${count} task${count === 1 ? "" : "s"} from ${name}.`;
}

export function buildReadPdfReply(name: string) {
  return `Alright, here is the extracted text from ${name}.`;
}

export function buildSpotifyPlayReply() {
  return "Alright, resuming Spotify.";
}

export function buildSpotifyQueryPlayReply(name: string, artist: string | null) {
  return `Alright, playing ${name}${artist ? ` by ${artist}` : ""} on Spotify.`;
}

export function buildSpotifyQueueReply(name: string, artist: string | null) {
  return `Alright, I queued ${name}${artist ? ` by ${artist}` : ""} on Spotify.`;
}

export function buildSpotifyLikeReply(name: string, artist: string | null) {
  return `Alright, I saved ${name}${artist ? ` by ${artist}` : ""} to your Spotify library.`;
}

export function buildSpotifyPauseReply() {
  return "Okay, pausing Spotify.";
}

export function buildSpotifySkipReply(direction: "next" | "previous") {
  return direction === "next"
    ? "Alright, skipping to the next track."
    : "Okay, going back to the previous track.";
}

export function buildSpotifyStatusReply(playback: SpotifyPlaybackState | null) {
  if (!playback?.title) {
    return "Spotify is connected, but nothing is actively playing right now.";
  }

  const action = playback.isPlaying ? "playing" : "paused on";
  return `Spotify is ${action} ${playback.title} by ${playback.artist ?? "an unknown artist"}.`;
}

export function buildUnreadEmailReply(count: number) {
  return count === 0
    ? "I checked Gmail, but there are no unread emails right now."
    : `I found ${count} unread emails in Gmail.`;
}

export function buildSearchEmailReply(query: string, count: number) {
  return count === 0
    ? `I did not find any Gmail messages matching ${query}.`
    : `I found ${count} Gmail messages matching ${query}.`;
}

export function buildSaveLatestEmailToNotionReply(title: string) {
  return `Alright, I saved the latest email to Notion as ${title}.`;
}

export function buildSaveEmailDigestToNotionReply(title: string, count: number) {
  return `Alright, I saved a Notion digest for ${count} emails as ${title}.`;
}

export function buildBatchEmailSaveReply(count: number) {
  return `Alright, I saved the first ${count} email${count === 1 ? "" : "s"} to Notion.`;
}

export function buildSaveIndexedEmailToNotionReply(title: string, index: number) {
  return `Alright, I saved email ${index} to Notion as ${title}.`;
}

export function buildSaveQueriedEmailToNotionReply(title: string, query: string) {
  return `Alright, I saved the email about ${query} to Notion as ${title}.`;
}

export function buildEmailToCalendarReply(title: string) {
  return `Alright, I opened a calendar item from the email about ${title}.`;
}

export function buildReadEmailReply(title: string) {
  return `Alright, here is the email about ${title}.`;
}

export function buildOpenEmailReply(title: string) {
  return `Alright, I opened the email about ${title}.`;
}

export function buildEmailSignalsReply(title: string) {
  return `Alright, I pulled the important details out of the email about ${title}.`;
}

export function buildCompleteTaskReply(title: string) {
  return `Alright, I marked ${title} as done in Notion.`;
}

export function buildUpdateTaskReply(title: string) {
  return `Alright, I updated that task in Notion to ${title}.`;
}

export function buildReopenTaskReply(title: string) {
  return `Alright, I reopened ${title} in Notion.`;
}

export function buildMoveTaskReply(title: string, dueLabel: string) {
  return `Alright, I moved ${title} to ${dueLabel}.`;
}

export function buildBatchPdfSummaryReply(count: number) {
  return `Alright, I summarized ${count} loaded PDF${count === 1 ? "" : "s"}.`;
}

export function buildBatchOverdueTaskReply(count: number) {
  return count === 0
    ? "I didn't find any overdue tasks to complete."
    : `Alright, I completed ${count} overdue task${count === 1 ? "" : "s"}.`;
}

export function buildDailyBriefReply(title: string) {
  return `Alright, I put together your daily brief and saved it to Notion as ${title}.`;
}

export function buildSleepReply(assistantName: string) {
  return `${assistantName} is going to sleep. Wake mode is off for this session.`;
}

export function buildStandbyReply(assistantName: string) {
  return `${assistantName} is standing by. Wake mode is armed again.`;
}

export function buildShutdownReply(assistantName: string) {
  return `Shutting down ${assistantName} now.`;
}

export function formatVoiceReplyModeLabel(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "quiet";
    case "brief":
      return "brief";
    case "detailed":
      return "detailed";
    default:
      return "normal";
  }
}

export function buildVoiceReplyModeReply(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "Okay. I will stay quiet unless you read the screen.";
    case "brief":
      return "Okay. I will keep my spoken replies brief.";
    case "detailed":
      return "Alright. I will use fuller spoken replies when I can.";
    default:
      return "Okay. I am back to my normal reply style.";
  }
}

export function buildVoiceReplyModeDetail(mode: VoiceReplyMode) {
  switch (mode) {
    case "quiet":
      return "JARVIS will keep listening, but it will stop speaking replies out loud.";
    case "brief":
      return "JARVIS will shorten spoken replies to the essential part when possible.";
    case "detailed":
      return "JARVIS will avoid shortening spoken replies and keep fuller voice confirmations.";
    default:
      return "JARVIS will use its standard spoken reply style.";
  }
}

export function formatBirthdayLabel(month: number, day: number) {
  const monthName = new Date(2000, month - 1, day).toLocaleString("en-US", {
    month: "long",
  });
  return `${monthName} ${day}`;
}

export function buildBirthdaySavedReply(name: string, birthdayLabel: string) {
  return `Okay. I saved ${name}'s birthday as ${birthdayLabel}.`;
}

export function buildBirthdayLookupReply(person: PersonMemoryRecord) {
  const details = [
    `${person.name}'s birthday is saved as ${person.birthdayLabel}.`,
    person.age ? `${person.name} is marked as turning ${person.age}.` : "",
    person.relationship ? `Relationship: ${person.relationship}.` : "",
    (person.giftNotes ?? []).length > 0 ? `Gift notes: ${(person.giftNotes ?? []).join(", ")}.` : "",
    (person.contactNotes ?? []).length > 0 ? `Contact notes: ${(person.contactNotes ?? []).slice(0, 3).join(", ")}.` : "",
    person.lastContactLabel ? `Last contact: ${person.lastContactLabel}.` : "",
    person.followUpDueLabel
      ? `Follow up: ${person.followUpDueLabel}${person.followUpReason ? ` for ${person.followUpReason}` : ""}.`
      : "",
    (person.reminderLeadDays ?? 0) > 0
      ? `Reminder timing: ${person.reminderLeadDays} day${person.reminderLeadDays === 1 ? "" : "s"} before.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return details;
}

export function buildBirthdayImportReply(count: number) {
  return count === 0
    ? "I didn't find any clear birthdays to save from that email yet."
    : `Alright. I saved ${count} birthday${count === 1 ? "" : "s"} to people memory.`;
}

export function buildBirthdayCalendarReply(name: string) {
  return `Alright. I added ${name}'s birthday to your calendar.`;
}

export function formatPersonAge(person: PersonMemoryRecord) {
  return person.age ? `turning ${person.age}` : null;
}

export function formatBirthdaySummary(person: PersonMemoryRecord) {
  const meta = [
    person.birthdayLabel,
    formatPersonAge(person),
    person.relationship,
    person.followUpDueLabel
      ? `follow up ${person.followUpDueLabel}${person.followUpReason ? ` (${person.followUpReason})` : ""}`
      : "",
    (person.reminderLeadDays ?? 0) > 0
      ? `remind ${person.reminderLeadDays} day${person.reminderLeadDays === 1 ? "" : "s"} before`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${person.name} - ${meta}`;
}

export function buildPeopleFollowUpReply(count: number) {
  return count === 0
    ? "I do not see any people follow-ups due soon."
    : `I found ${count} people follow-up${count === 1 ? "" : "s"} due soon.`;
}

export function buildPeopleCheckInReply(count: number) {
  return count === 0
    ? "I do not see anyone flagged for a check-in this week."
    : `I found ${count} people to check in with this week.`;
}

export function formatPersonFollowUp(person: PersonMemoryRecord) {
  const details = [
    person.followUpDueLabel ? `follow up ${person.followUpDueLabel}` : "",
    person.followUpReason ? person.followUpReason : "",
    person.relationship ? person.relationship : "",
  ]
    .filter(Boolean)
    .join(", ");
  return details ? `${person.name} - ${details}` : person.name;
}

export function buildTravelExtractionReply(title: string) {
  return `Alright. I pulled the travel details I could find from ${title}.`;
}

export function buildTravelSavedReply(title: string) {
  return `Okay. I saved the travel summary from ${title} to Notion.`;
}

export function buildTravelCalendarReply(title: string) {
  return `Alright. I added a travel calendar item from ${title}.`;
}

export function buildTravelChecklistReply(title: string) {
  return `Alright. Here is what you likely need for ${title}.`;
}

export function buildTravelTimelineReply(title: string) {
  return `Alright. Here is the trip timeline I built for ${title}.`;
}

export function buildExpenseExtractionReply(title: string) {
  return `Alright. I pulled the expense details I could find from ${title}.`;
}

export function buildExpenseSavedReply(title: string) {
  return `Okay. I saved the expense summary from ${title} to Notion.`;
}

export function buildExpenseSummaryReply(windowLabel: "weekly" | "monthly", count: number, total: number | null) {
  if (count === 0) {
    return `I couldn't find any ${windowLabel} expenses yet.`;
  }

  if (total !== null) {
    return `I found ${count} ${windowLabel} expense${count === 1 ? "" : "s"} totaling $${total.toFixed(2)}.`;
  }

  return `I found ${count} ${windowLabel} expense${count === 1 ? "" : "s"}.`;
}

export function buildCategoryExpenseReply(category: string, count: number, total: number | null) {
  if (count === 0) {
    return `I couldn't find any ${category} expenses this month yet.`;
  }

  if (total !== null) {
    return `I found ${count} ${category} expense${count === 1 ? "" : "s"} this month totaling $${total.toFixed(2)}.`;
  }

  return `I found ${count} ${category} expense${count === 1 ? "" : "s"} this month.`;
}

export function buildRecurringExpenseReply(count: number, total: number | null) {
  if (count === 0) {
    return "I couldn't find any likely recurring subscriptions yet.";
  }

  if (total !== null) {
    return `I found ${count} likely recurring charge${count === 1 ? "" : "s"} totaling $${total.toFixed(2)}.`;
  }

  return `I found ${count} likely recurring charge${count === 1 ? "" : "s"}.`;
}

export function normalizeExpenseCategoryLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const known: Array<[string, string]> = [
    ["food", "Food"],
    ["restaurant", "Food"],
    ["coffee", "Food"],
    ["travel", "Travel"],
    ["trip", "Travel"],
    ["shopping", "Shopping"],
    ["shop", "Shopping"],
    ["bill", "Bills"],
    ["bills", "Bills"],
    ["rent", "Bills"],
    ["subscription", "Subscription"],
    ["subscriptions", "Subscription"],
    ["membership", "Subscription"],
    ["education", "Education"],
    ["school", "Education"],
  ];

  return known.find(([alias]) => alias === normalized)?.[1] ?? value.trim();
}

export function buildPackageExtractionReply(title: string) {
  return `Alright. I pulled the package details I could find from ${title}.`;
}

export function buildPackageSavedReply(title: string) {
  return `Okay. I saved the package summary from ${title} to Notion.`;
}

export function buildPackageSummaryReply(arrivingTodayCount: number) {
  if (arrivingTodayCount > 0) {
    return `I found ${arrivingTodayCount} package${arrivingTodayCount === 1 ? "" : "s"} arriving today.`;
  }

  return "I checked your saved package updates.";
}

export function buildPackageTomorrowReply(count: number) {
  return count === 0
    ? "I do not see any packages arriving tomorrow."
    : `I found ${count} package${count === 1 ? "" : "s"} arriving tomorrow.`;
}

export function buildDelayedPackageReply(count: number) {
  return count === 0
    ? "I do not see any delayed packages right now."
    : `I found ${count} delayed package${count === 1 ? "" : "s"}.`;
}

export function buildMeetingPrepReply(title: string) {
  return `Alright. I put together a meeting prep summary for ${title}.`;
}

export function buildMeetingPrepSavedReply(title: string) {
  return `Okay. I saved the meeting prep note for ${title} to Notion.`;
}

export function buildSchoolPlanReply() {
  return "Alright. I put together a school mode study plan for you.";
}

export function buildSchoolPlanSavedReply(title: string) {
  return `Okay. I saved your school mode plan to Notion as ${title}.`;
}

export function formatEmailForNotion(email: EmailRecord) {
  return [
    `Email: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    email.body ? email.body.slice(0, 4000) : "",
    email.body ? "" : "",
    email.snippet || "No preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatEmailForReading(email: EmailRecord) {
  return [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    email.body?.trim() || email.snippet || "No email body was available.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isPdfFile(file: FileRecord) {
  return file.path.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".pdf");
}

export function getLoadedPdfFiles(files: FileRecord[]) {
  return files.filter(isPdfFile);
}

export function getPdfByIndex(files: FileRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return getLoadedPdfFiles(files)[index - 1] ?? null;
}

export function getCurrentPdf(files: FileRecord[]) {
  return getLoadedPdfFiles(files)[0] ?? null;
}

export function createActivePdfContext(file: FileRecord): ActiveConversationContext {
  return {
    kind: "pdf",
    path: file.path,
    label: file.name,
  };
}

export function findPdfByQuery(files: FileRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    getLoadedPdfFiles(files).find((file) =>
      `${file.name} ${file.path}`.toLowerCase().includes(normalized),
    ) ?? null
  );
}

export function buildGmailThreadUrl(threadId: string) {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

export function extractUniqueMatches(text: string, pattern: RegExp, formatter?: (value: string) => string) {
  const matches = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const raw = (match[1] ?? match[0] ?? "").trim();
    if (!raw) {
      continue;
    }

    matches.add(formatter ? formatter(raw) : raw);
  }

  return Array.from(matches);
}

export function extractSentenceMatches(text: string, pattern: RegExp) {
  const normalized = text.replace(/\r/g, " ");
  const sentences = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return Array.from(
    new Set(sentences.filter((sentence) => pattern.test(sentence)).map((sentence) => sentence.slice(0, 220))),
  );
}

export function extractEmailSignals(email: EmailRecord): EmailSignals {
  const text = `${email.subject}\n${email.snippet}\n${email.body}`.replace(/\s+/g, " ").trim();

  const dateFragments = extractUniqueMatches(
    text,
    /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );
  const monthDayFragments = extractUniqueMatches(
    text,
    /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );
  const numericDateFragments = extractUniqueMatches(
    text,
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
  );

  const deadlines = extractSentenceMatches(
    text,
    /\b(deadline|due|submit|submission|expires|expiration|last date|complete by|pay by)\b/i,
  );

  const birthdays = extractSentenceMatches(
    text,
    /\b(birthday|born on|turns?\s+\d+|anniversary)\b/i,
  ).concat(
    extractSentenceMatches(
      text,
      /\b(happy birthday)\b/i,
    ),
  );

  const meetings = extractSentenceMatches(
    text,
    /\b(meeting|meet|call|zoom|teams|interview|appointment|session|invite)\b/i,
  );

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  );

  const reminders = extractSentenceMatches(
    text,
    /\b(reminder|remind|don't forget|do not forget|follow up|remember to|need to)\b/i,
  );

  const enrichedDeadlines = Array.from(
    new Set(
      deadlines.concat(
        dateFragments.map((fragment) => `Date mention: ${fragment}`),
        monthDayFragments.map((fragment) => `Date mention: ${fragment}`),
        numericDateFragments.map((fragment) => `Date mention: ${fragment}`),
      ),
    ),
  );

  return {
    deadlines: enrichedDeadlines.slice(0, 6),
    birthdays: birthdays.slice(0, 6),
    meetings: meetings.slice(0, 6),
    addresses: addresses.slice(0, 6),
    reminders: reminders.slice(0, 6),
  };
}

export function parseBirthdayMonthDay(text: string) {
  const normalized = text.trim();
  const monthMatch = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
  );
  if (monthMatch) {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const month = monthNames.indexOf(monthMatch[1].toLowerCase()) + 1;
    const day = Number(monthMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthdayLabel: formatBirthdayLabel(month, day),
      };
    }
  }

  const numericMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month,
        day,
        birthdayLabel: formatBirthdayLabel(month, day),
      };
    }
  }

  return null;
}

export type BirthdayCandidate = {
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
  age: number | null;
};

export function extractBirthdayCandidatesFromText(text: string) {
  const normalized = text.replace(/\r/g, " ");
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})['’]s birthday is ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /birthday for ([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}) is ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}) turns?\s+\d+\s+on ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})['’]s birthday(?: is| falls on)?\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
  ];

  const candidates = new Map<string, BirthdayCandidate>();
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const name = match[1]?.trim();
      const dateText = match[2]?.trim();
      if (!name || !dateText) {
        continue;
      }

      const parsed = parseBirthdayMonthDay(dateText);
      if (!parsed) {
        continue;
      }

      candidates.set(name.toLowerCase(), {
        name,
        birthdayLabel: parsed.birthdayLabel,
        month: parsed.month,
        day: parsed.day,
        age: null,
      });
    }
  }

  for (const match of normalized.matchAll(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}) turns?\s+(\d{1,3})\s+on ((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2})/gi,
  )) {
    const name = match[1]?.trim();
    const age = Number(match[2]);
    const parsed = parseBirthdayMonthDay(match[3]?.trim() ?? "");
    if (!name || !parsed || !Number.isFinite(age) || age <= 0) {
      continue;
    }

    candidates.set(name.toLowerCase(), {
      name,
      birthdayLabel: parsed.birthdayLabel,
      month: parsed.month,
      day: parsed.day,
      age,
    });
  }

  return Array.from(candidates.values());
}

export function extractBirthdayCandidatesFromEmail(email: EmailRecord) {
  return extractBirthdayCandidatesFromText(`${email.subject}\n${email.snippet}\n${email.body ?? ""}`);
}

export type PersonBirthdaySaveInput = {
  name: string;
  birthdayLabel: string;
  month: number;
  day: number;
  age?: number | null;
  relationship?: string | null;
  giftNotes?: string[];
  contactNotes?: string[];
  lastContactLabel?: string | null;
  followUpDueLabel?: string | null;
  followUpReason?: string | null;
  reminderLeadDays?: number;
  calendarLinkedAt?: string | null;
  source: "manual" | "gmail";
};

export function extractTravelDetails(email: EmailRecord): TravelExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const transport = extractSentenceMatches(
    text,
    /\b(flight|airline|departure|arrival|boarding|gate|terminal|train|rail|platform|bus|ferry)\b/i,
  );

  const stays = extractSentenceMatches(
    text,
    /\b(hotel|check-in|check in|check-out|check out|reservation|stay|room|lodging|hostel)\b/i,
  );

  const departures = extractSentenceMatches(
    text,
    /\b(depart|departure|leav(?:e|ing)|flight to|takeoff|boarding)\b/i,
  );

  const arrivals = extractSentenceMatches(
    text,
    /\b(arriv(?:e|al|ing)|landing|landed|destination|return flight)\b/i,
  );

  const hotels = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b([A-Z][A-Za-z0-9&.' -]{2,40}(?:Hotel|Inn|Resort|Suites|Lodge|Hostel))\b/g,
      ).concat(
        extractUniqueMatches(
          text,
          /\bhotel[:\s-]*([A-Z][A-Za-z0-9&.' -]{2,40})\b/gi,
        ),
      ),
    ),
  ).slice(0, 6);

  const checkIns = extractSentenceMatches(
    text,
    /\b(check-in|check in|arrival date)\b/i,
  );

  const checkOuts = extractSentenceMatches(
    text,
    /\b(check-out|check out|departure date)\b/i,
  );

  const bookings = extractSentenceMatches(
    text,
    /\b(booking|booked|itinerary|reservation|trip|confirmation|check-in|boarding pass)\b/i,
  );

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  );

  const dates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
      ),
    ),
  );

  const confirmationCodes = extractUniqueMatches(
    text,
    /\b(?:confirmation|booking|reservation|reference|pnr)(?:\s*(?:code|number|#))?[:\s-]*([A-Z0-9]{5,10})\b/gi,
    (value) => value.toUpperCase(),
  );

  return {
    transport: transport.slice(0, 6),
    departures: departures.slice(0, 6),
    arrivals: arrivals.slice(0, 6),
    hotels: hotels.slice(0, 6),
    checkIns: checkIns.slice(0, 6),
    checkOuts: checkOuts.slice(0, 6),
    stays: stays.slice(0, 6),
    bookings: bookings.slice(0, 6),
    addresses: addresses.slice(0, 6),
    dates: dates.slice(0, 8),
    confirmationCodes: confirmationCodes.slice(0, 6),
  };
}

export function formatTravelExtraction(email: EmailRecord, details: TravelExtraction) {
  const timeline = buildTravelTimeline(details);
  const checklist = buildTravelChecklist(details);
  const sections: Array<[string, string[]]> = [
    ["Transport", details.transport],
    ["Departure", details.departures],
    ["Arrival", details.arrivals],
    ["Hotels", details.hotels],
    ["Check-in", details.checkIns],
    ["Check-out", details.checkOuts],
    ["Stays", details.stays],
    ["Bookings", details.bookings],
    ["Dates", details.dates],
    ["Addresses", details.addresses],
    ["Confirmation codes", details.confirmationCodes],
    ["Trip timeline", timeline],
    ["Trip checklist", checklist],
  ];

  return [
    `Travel extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatTravelForNotion(email: EmailRecord, details: TravelExtraction) {
  const timeline = buildTravelTimeline(details);
  const checklist = buildTravelChecklist(details);
  return [
    `Travel Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Transport",
    ...(details.transport.length > 0 ? details.transport.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Departure",
    ...(details.departures.length > 0 ? details.departures.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Arrival",
    ...(details.arrivals.length > 0 ? details.arrivals.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Hotels",
    ...(details.hotels.length > 0 ? details.hotels.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Check-in",
    ...(details.checkIns.length > 0 ? details.checkIns.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Check-out",
    ...(details.checkOuts.length > 0 ? details.checkOuts.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Stays",
    ...(details.stays.length > 0 ? details.stays.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Bookings",
    ...(details.bookings.length > 0 ? details.bookings.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Dates",
    ...(details.dates.length > 0 ? details.dates.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Addresses",
    ...(details.addresses.length > 0 ? details.addresses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Confirmation codes",
    ...(details.confirmationCodes.length > 0
      ? details.confirmationCodes.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Trip timeline",
    ...(timeline.length > 0 ? timeline.map((item) => `- ${item}`) : ["- No timeline cues detected"]),
    "",
    "Trip checklist",
    ...(checklist.length > 0 ? checklist.map((item) => `- ${item}`) : ["- No checklist items suggested"]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getPrimaryTravelSummary(details: TravelExtraction) {
  return {
    transport: details.transport[0] ?? details.bookings[0] ?? null,
    departure: details.departures[0] ?? details.dates[0] ?? null,
    arrival: details.arrivals[0] ?? null,
    hotel: details.hotels[0] ?? details.stays[0] ?? null,
    checkIn: details.checkIns[0] ?? null,
    checkOut: details.checkOuts[0] ?? null,
    confirmationCode: details.confirmationCodes[0] ?? null,
  };
}

export function buildTravelTimeline(details: TravelExtraction) {
  const timeline = [
    ...details.departures.map((item) => `Departure: ${item}`),
    ...details.arrivals.map((item) => `Arrival: ${item}`),
    ...details.checkIns.map((item) => `Hotel check-in: ${item}`),
    ...details.checkOuts.map((item) => `Hotel check-out: ${item}`),
    ...details.dates.map((item) => `Date cue: ${item}`),
  ];

  return Array.from(new Set(timeline)).slice(0, 12);
}

export function buildTravelChecklist(details: TravelExtraction) {
  const checklist: string[] = [];

  if (details.confirmationCodes.length > 0) {
    checklist.push("Keep your booking or confirmation code ready.");
  }
  if (details.transport.length > 0 || details.departures.length > 0) {
    checklist.push("Double-check your departure time, terminal, gate, or platform.");
  }
  if (details.arrivals.length > 0) {
    checklist.push("Review your arrival details and onward transport.");
  }
  if (details.hotels.length > 0 || details.checkIns.length > 0) {
    checklist.push("Have your hotel check-in details ready.");
  }
  if (details.checkOuts.length > 0) {
    checklist.push("Plan for hotel check-out timing before you leave.");
  }
  if (details.addresses.length > 0) {
    checklist.push("Save the destination or hotel address for quick access.");
  }

  if (checklist.length === 0) {
    checklist.push("Review the full itinerary and save any important trip details.");
  }

  return checklist.slice(0, 8);
}

export function estimateTravelSegmentCount(details: TravelExtraction) {
  return Math.max(
    1,
    details.departures.length,
    details.arrivals.length,
    details.hotels.length > 0 ? 1 : 0,
  );
}

export function buildTravelCalendarIntent(email: EmailRecord, details: TravelExtraction) {
  const combined = [
    details.departures[0] ?? "",
    details.checkIns[0] ?? "",
    details.dates[0] ?? "",
    email.subject,
    email.snippet,
    email.body ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const start =
    parseDateFromFlexibleText(details.dates[0] ?? "") ??
    parseDateFromEmailText(combined);
  if (!start) {
    return null;
  }

  const end = addMinutes(start, 60);
  const travelLabel =
    getPrimaryTravelSummary(details).transport ??
    getPrimaryTravelSummary(details).hotel ??
    "Trip";

  return {
    title: `Trip: ${travelLabel} - ${email.subject}`,
    start,
    end,
  };
}

export function extractExpenseDetails(email: EmailRecord): ExpenseExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const merchants = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(?:from|at|merchant|seller|store)[:\s-]*([A-Z][A-Za-z0-9&.' -]{2,40})\b/g,
      ).concat(
        extractUniqueMatches(
          text,
          /\b(?:receipt|invoice|order confirmation|payment confirmation) (?:from|for) ([A-Z][A-Za-z0-9&.' -]{2,40})\b/gi,
        ),
      ),
    ),
  ).slice(0, 6);

  const amounts = extractUniqueMatches(
    text,
    /\b((?:USD|usd|\$)\s?\d+(?:,\d{3})*(?:\.\d{2})?)\b/g,
    (value) => value.replace(/\s+/g, ""),
  ).slice(0, 6);

  const categories = extractSentenceMatches(
    text,
    /\b(receipt|invoice|order|payment|charged|purchase|subscription|bill|tax|total)\b/i,
  ).slice(0, 6);

  const dates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi,
        ),
      ),
    ),
  ).slice(0, 8);

  const orderNumbers = extractUniqueMatches(
    text,
    /\b(?:order|invoice|receipt|transaction|payment)(?:\s*(?:number|no|#|id))?[:\s-]*([A-Z0-9-]{5,20})\b/gi,
    (value) => value.toUpperCase(),
  ).slice(0, 6);

  const notes = extractSentenceMatches(
    text,
    /\b(receipt|invoice|order|paid|charged|total|subtotal|tax|delivery fee|subscription|renewal)\b/i,
  ).slice(0, 6);

  const categorySignals: Array<[string, RegExp]> = [
    ["Travel", /\b(flight|hotel|booking|trip|uber|lyft|airline|train)\b/i],
    ["Food", /\b(restaurant|cafe|coffee|meal|food|doordash|ubereats|grubhub)\b/i],
    ["Shopping", /\b(order|amazon|store|purchase|retail|shop)\b/i],
    ["Bills", /\b(utility|electric|water|internet|phone|rent|bill)\b/i],
    ["Subscription", /\b(subscription|renewal|monthly plan|membership|netflix|spotify|prime)\b/i],
    ["Education", /\b(course|tuition|school|class|exam|udemy|coursera)\b/i],
  ];

  const normalizedCategory =
    categorySignals.find(([, pattern]) => pattern.test(text))?.[0] ??
    (categories[0] ? "General" : null);

  const recurringLikely = /\b(subscription|renewal|monthly plan|membership|autopay|recurring|billed monthly|renews on)\b/i.test(
    text,
  );

  const primaryAmountValue = (() => {
    const value = amounts[0]?.replace(/USD/gi, "").replace(/\$/g, "").replace(/,/g, "").trim();
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const primaryDate = dates[0] ?? null;

  return {
    merchants,
    amounts,
    categories,
    dates,
      orderNumbers,
      notes,
      normalizedCategory,
      primaryAmountValue,
      primaryDate,
      recurringLikely,
  };
}

export function formatExpenseExtraction(email: EmailRecord, details: ExpenseExtraction) {
  const sections: Array<[string, string[]]> = [
    ["Merchants", details.merchants],
    ["Amounts", details.amounts],
    ["Detected category", details.normalizedCategory ? [details.normalizedCategory] : []],
    ["Recurring subscription", details.recurringLikely ? ["Yes"] : []],
    ["Dates", details.dates],
    ["Order numbers", details.orderNumbers],
    ["Receipt notes", details.notes],
    ["Category cues", details.categories],
  ];

  return [
    `Expense extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatExpenseForNotion(email: EmailRecord, details: ExpenseExtraction) {
  return [
    `Expense Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Merchants",
    ...(details.merchants.length > 0 ? details.merchants.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Amounts",
    ...(details.amounts.length > 0 ? details.amounts.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Detected category",
    ...(details.normalizedCategory ? [`- ${details.normalizedCategory}`] : ["- None detected"]),
    "",
    "Recurring subscription",
    ...(details.recurringLikely ? ["- Likely recurring charge"] : ["- Not clearly recurring"]),
    "",
    "Dates",
    ...(details.dates.length > 0 ? details.dates.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Order numbers",
    ...(details.orderNumbers.length > 0 ? details.orderNumbers.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Receipt notes",
    ...(details.notes.length > 0 ? details.notes.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Category cleanup hint",
    ...(details.normalizedCategory ? [`- Use ${details.normalizedCategory} as the default category for this expense.`] : ["- No strong category hint yet."]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function extractPackageDetails(email: EmailRecord): PackageExtraction {
  const text = `${email.subject}\n${email.snippet}\n${email.body ?? ""}`.replace(/\s+/g, " ").trim();

  const carriers = Array.from(
    new Set(
      [
        ...extractUniqueMatches(text, /\b(UPS|FedEx|USPS|DHL|Amazon Logistics|Amazon)\b/gi, (value) =>
          value
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\bUsps\b/i, "USPS")
            .replace(/\bUps\b/i, "UPS"),
        ),
      ],
    ),
  ).slice(0, 5);

  const merchants = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(?:from|seller|merchant|store)[:\s-]*([A-Z][A-Za-z0-9&.' -]{2,40})\b/gi,
      ),
    ),
  ).slice(0, 4);

  const items = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(?:item|order|package)[:\s-]*([A-Z][A-Za-z0-9&.' -]{2,60})\b/gi,
      ),
    ),
  ).slice(0, 4);

  const statuses = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b(out for delivery|delivered|arriving today|arriving tomorrow|arriving|shipped|shipment delayed|in transit|ready for pickup|picked up)\b/gi,
        (value) => value.toLowerCase(),
      ).map((value) => value.charAt(0).toUpperCase() + value.slice(1)),
    ),
  ).slice(0, 8);

  const deliveryDates = Array.from(
    new Set(
      extractUniqueMatches(
        text,
        /\b((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
      ).concat(
        extractUniqueMatches(
          text,
          /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
        extractUniqueMatches(
          text,
          /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/gi,
        ),
      ),
    ),
  ).slice(0, 8);

  const trackingNumbers = extractUniqueMatches(
    text,
    /\b(?:tracking|track|shipment|package)(?:\s*(?:number|no|#|id|code))?[:\s-]*([A-Z0-9-]{8,24})\b/gi,
    (value) => value.toUpperCase(),
  ).slice(0, 6);

  const addresses = extractUniqueMatches(
    text,
    /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy))\b/gi,
    (value) => value.replace(/\s+/g, " "),
  ).slice(0, 6);

  const notes = extractSentenceMatches(
    text,
    /\b(package|shipment|delivery|arriving|tracking|delivered|carrier|pickup|drop[- ]off)\b/i,
  ).slice(0, 6);

  return {
    carriers,
    merchants,
    items,
    statuses,
    deliveryDates,
    trackingNumbers,
    addresses,
    notes,
  };
}

export function formatPackageExtraction(email: EmailRecord, details: PackageExtraction) {
  const sections: Array<[string, string[]]> = [
    ["Carriers", details.carriers],
    ["Merchants", details.merchants],
    ["Items", details.items],
    ["Statuses", details.statuses],
    ["Delivery dates", details.deliveryDates],
    ["Tracking numbers", details.trackingNumbers],
    ["Addresses", details.addresses],
    ["Package notes", details.notes],
  ];

  return [
    `Package extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatPackageForNotion(email: EmailRecord, details: PackageExtraction) {
  return [
    `Package Summary: ${email.subject}`,
    "",
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    "Carriers",
    ...(details.carriers.length > 0 ? details.carriers.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Merchants",
    ...(details.merchants.length > 0 ? details.merchants.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Items",
    ...(details.items.length > 0 ? details.items.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Statuses",
    ...(details.statuses.length > 0 ? details.statuses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Delivery dates",
    ...(details.deliveryDates.length > 0
      ? details.deliveryDates.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Tracking numbers",
    ...(details.trackingNumbers.length > 0
      ? details.trackingNumbers.map((item) => `- ${item}`)
      : ["- None detected"]),
    "",
    "Addresses",
    ...(details.addresses.length > 0 ? details.addresses.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Package notes",
    ...(details.notes.length > 0 ? details.notes.map((item) => `- ${item}`) : ["- None detected"]),
    "",
    "Email preview",
    email.body ? email.body.slice(0, 2500) : email.snippet || "No email preview available.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isTodayDeliveryLabel(label: string | null) {
  if (!label) {
    return false;
  }

  return /\b(arriving today|today)\b/i.test(label);
}

export function isTomorrowDeliveryLabel(label: string | null) {
  if (!label) {
    return false;
  }

  return /\b(arriving tomorrow|tomorrow)\b/i.test(label);
}

export function hasTravelSignal(details: TravelExtraction) {
  return (
    details.transport.length > 0 ||
    details.departures.length > 0 ||
    details.arrivals.length > 0 ||
    details.hotels.length > 0 ||
    details.stays.length > 0 ||
    details.bookings.length > 0 ||
    details.confirmationCodes.length > 0
  );
}

export function hasExpenseSignal(details: ExpenseExtraction) {
  return (
    details.merchants.length > 0 ||
    details.amounts.length > 0 ||
    details.orderNumbers.length > 0 ||
    details.notes.length > 0
  );
}

export function hasPackageSignal(details: PackageExtraction) {
  return (
    details.carriers.length > 0 ||
    details.statuses.length > 0 ||
    details.deliveryDates.length > 0 ||
    details.trackingNumbers.length > 0
  );
}

export function tokenizePrepQuery(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export function scoreMeetingPrepEvent(event: GoogleCalendarEventRecord, query: string | null) {
  if (!query) {
    return 1;
  }

  const haystack = `${event.summary} ${event.start ?? ""}`.toLowerCase();
  return tokenizePrepQuery(query).reduce(
    (score, token) => (haystack.includes(token) ? score + 1 : score),
    0,
  );
}

export function findMeetingPrepEvent(events: GoogleCalendarEventRecord[], query: string | null) {
  if (events.length === 0) {
    return null;
  }

  if (!query) {
    return events[0];
  }

  const scored = events
    .map((event) => ({ event, score: scoreMeetingPrepEvent(event, query) }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].event : null;
}

export function findRelatedMeetingEmails(event: GoogleCalendarEventRecord, emails: EmailRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return emails.filter((email) => {
    const haystack = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 3);
}

export function findRelatedMeetingNotes(event: GoogleCalendarEventRecord, notes: NoteRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return notes.filter((note) => {
    const haystack = `${note.title} ${note.summary}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 3);
}

export function findRelatedMeetingTasks(event: GoogleCalendarEventRecord, tasks: PlannerTaskRecord[]) {
  const tokens = tokenizePrepQuery(event.summary);
  return tasks.filter((task) => {
    const haystack = `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).slice(0, 4);
}

export function extractMeetingAgendaCandidates(
  emails: EmailRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  const candidates = new Set<string>();

  for (const email of emails) {
    for (const sentence of extractSentenceMatches(
      `${email.subject}. ${email.snippet}. ${email.body ?? ""}`,
      /\b(agenda|discuss|review|update|decision|plan|next step|topic|goal|question)\b/i,
    )) {
      candidates.add(sentence);
    }
  }

  for (const note of notes) {
    const summary = `${note.title}. ${note.summary}`;
    for (const sentence of extractSentenceMatches(
      summary,
      /\b(agenda|discuss|review|update|decision|plan|next step|topic|goal|question)\b/i,
    )) {
      candidates.add(sentence);
    }
  }

  for (const task of tasks) {
    candidates.add(`${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`);
  }

  return Array.from(candidates).slice(0, 6);
}

export function buildMeetingFocusSummary(
  event: GoogleCalendarEventRecord,
  emails: EmailRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  const parts: string[] = [];
  if (tasks.length > 0) {
    parts.push(`clear ${tasks.length} related task${tasks.length === 1 ? "" : "s"}`);
  }
  if (emails.length > 0) {
    parts.push(`scan ${emails.length} related email${emails.length === 1 ? "" : "s"}`);
  }
  if (notes.length > 0) {
    parts.push(`review ${notes.length} note${notes.length === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return `Focus: review the calendar entry for ${event.summary} directly because I could not find supporting context yet.`;
  }

  return `Focus: before ${event.summary}, ${parts.join(", ")}.`;
}

export function buildMeetingActionItems(
  emails: EmailRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
) {
  const items: string[] = [];

  if (tasks.length > 0) {
    items.push(...tasks.map((task) => `Review task: ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`));
  }
  if (emails.length > 0) {
    items.push(...emails.slice(0, 2).map((email) => `Check email: ${email.subject}`));
  }
  if (notes.length > 0) {
    items.push(...notes.slice(0, 2).map((note) => `Open note: ${note.title}`));
  }

  if (items.length === 0) {
    items.push("Open the calendar event and add your own agenda if needed.");
  }

  return items.slice(0, 6);
}

export function findMeetingRelatedPeople(
  event: GoogleCalendarEventRecord,
  emails: EmailRecord[],
  people: PersonMemoryRecord[],
) {
  const related = new Set<string>();
  const summary = event.summary.toLowerCase();

  for (const person of people) {
    if (summary.includes(person.name.toLowerCase())) {
      related.add(person.name);
    }
  }

  for (const email of emails) {
    const sender = email.from.split("<")[0]?.trim();
    if (sender) {
      related.add(sender);
    }
  }

  return Array.from(related).slice(0, 5);
}

export function buildMeetingChangeSummary(
  event: GoogleCalendarEventRecord,
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  previous: MeetingPrepMemoryRecord | null,
) {
  if (!previous) {
    return "This is your first saved prep snapshot for this meeting.";
  }

  const parts: string[] = [];
  if (emails.length > 0) {
    parts.push(`${emails.length} related email${emails.length === 1 ? "" : "s"} are in view now`);
  }
  if (tasks.length > 0) {
    parts.push(`${tasks.length} related task${tasks.length === 1 ? "" : "s"} are active`);
  }
  if (previous.actionItems.length > 0) {
    parts.push(`the last prep had ${previous.actionItems.length} saved action item${previous.actionItems.length === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return `No major context changes were detected for ${event.summary} since the last prep.`;
  }

  return `Since the last prep for ${event.summary}, ${parts.join(", ")}.`;
}

export function buildMeetingPrepContent(
  event: GoogleCalendarEventRecord,
  emails: EmailRecord[],
  notes: NoteRecord[],
  tasks: PlannerTaskRecord[],
  people: PersonMemoryRecord[],
  previous: MeetingPrepMemoryRecord | null,
) {
  const focusSummary = buildMeetingFocusSummary(event, emails, notes, tasks);
  const agendaCandidates = extractMeetingAgendaCandidates(emails, notes, tasks);
  const actionItems = buildMeetingActionItems(emails, notes, tasks);
  const relatedPeople = findMeetingRelatedPeople(event, emails, people);
  const changeSummary = buildMeetingChangeSummary(event, emails, tasks, previous);

  return [
    `Meeting Prep: ${event.summary}`,
    "",
    `Time: ${formatCalendarEventTimeLabel(event.start)}${
      event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
    }`,
    event.htmlLink ? `Calendar link: ${event.htmlLink}` : "",
    "",
    focusSummary,
    "",
    changeSummary,
    "",
    "Likely agenda",
    ...(agendaCandidates.length > 0
      ? agendaCandidates.map((item) => `- ${item}`)
      : ["- No explicit agenda cues were detected yet."]),
    "",
    "Related email",
    ...(emails.length > 0
      ? emails.map((email) => `- ${email.subject} - ${email.from}`)
      : ["- No related loaded emails found."]),
    "",
    "Related notes",
    ...(notes.length > 0
      ? notes.map((note) => `- ${note.title}`)
      : ["- No related notes found."]),
    "",
    "People context",
    ...(relatedPeople.length > 0
      ? relatedPeople.map((person) => `- ${person}`)
      : ["- No specific people context detected yet."]),
    "",
    "Related tasks",
    ...(tasks.length > 0
      ? tasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No related tasks found."]),
    "",
    "Action items",
    ...actionItems.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSchoolFocusSummary(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  studyTasks: PlannerTaskRecord[],
  loadedPdfs: FileRecord[],
) {
  const focusPoints: string[] = [];

  if (studyTasks.filter((task) => task.status === "overdue").length > 0) {
    focusPoints.push(
      `clear ${studyTasks.filter((task) => task.status === "overdue").length} overdue school task${
        studyTasks.filter((task) => task.status === "overdue").length === 1 ? "" : "s"
      }`,
    );
  }

  if (studyTasks.filter((task) => task.status === "today").length > 0) {
    focusPoints.push(
      `finish ${studyTasks.filter((task) => task.status === "today").length} school task${
        studyTasks.filter((task) => task.status === "today").length === 1 ? "" : "s"
      } due today`,
    );
  }

  if (urgentEmails.length > 0) {
    focusPoints.push(
      `review ${urgentEmails.length} study-related email${urgentEmails.length === 1 ? "" : "s"}`,
    );
  }

  if (loadedPdfs.length > 0) {
    focusPoints.push(`use ${loadedPdfs.length} loaded PDF${loadedPdfs.length === 1 ? "" : "s"} as study material`);
  }

  if (focusPoints.length === 0) {
    return "School mode focus: keep momentum steady and load a PDF or school task to plan around.";
  }

  return `School mode focus: ${focusPoints.join(", ")}.`;
}

export function detectSchoolSubjects(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  files: FileRecord[],
) {
  const text = [
    ...emails.map((email) => `${email.subject} ${email.snippet} ${email.body}`),
    ...tasks.map((task) => `${task.title} ${task.sourceNote.summary}`),
    ...files.map((file) => file.name),
  ]
    .join(" ")
    .toLowerCase();

  const subjectSignals: Array<[string, RegExp]> = [
    ["Calculus", /\b(calculus|calc|derivative|integral)\b/i],
    ["Math", /\b(math|algebra|geometry|statistics)\b/i],
    ["Physics", /\b(physics|mechanics|thermodynamics)\b/i],
    ["Chemistry", /\b(chemistry|organic chem|lab report)\b/i],
    ["Biology", /\b(biology|bio|anatomy|genetics)\b/i],
    ["Computer Science", /\b(computer science|cs\b|programming|coding|react|python|java)\b/i],
    ["English", /\b(english|essay|literature|reading)\b/i],
    ["History", /\b(history|historical|research paper)\b/i],
    ["Economics", /\b(economics|microeconomics|macroeconomics|finance)\b/i],
  ];

  return subjectSignals
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
    .slice(0, 6);
}

export function buildSchoolSessions(
  subjects: string[],
  loadedPdfs: FileRecord[],
  studyTasks: PlannerTaskRecord[],
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
) {
  const sessions: string[] = [];
  const topSubjects = subjects.length > 0 ? subjects : ["General study"];
  const dayLabels = ["Today", "Tomorrow", "Next day"];

  for (const [index, subject] of topSubjects.slice(0, 3).entries()) {
    const matchingPdf = loadedPdfs.find((file) => file.name.toLowerCase().includes(subject.toLowerCase().split(" ")[0]));
    const matchingTask = studyTasks.find((task) =>
      `${task.title} ${task.sourceNote.summary}`.toLowerCase().includes(subject.toLowerCase().split(" ")[0]),
    );

    sessions.push(
      `${dayLabels[index] ?? `Day ${index + 1}`} - ${subject}: ${matchingPdf ? `review ${matchingPdf.name}` : "review your most relevant notes"}${
        matchingTask ? ` and finish ${matchingTask.title}` : ""
      }`,
    );
  }

  if (urgentEmails.length > 0) {
    sessions.push(`Inbox check: review ${urgentEmails[0].email.subject} for deadline or schedule changes.`);
  }

  return sessions.slice(0, 5);
}

export function extractSchoolAssignments(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  studyTasks: PlannerTaskRecord[],
) {
  const assignments = new Set<string>();

  for (const task of studyTasks) {
    assignments.add(task.dueLabel ? `${task.title} (${task.dueLabel})` : task.title);
  }

  for (const { email } of urgentEmails) {
    if (/\b(assignment|project|exam|quiz|homework|paper|lab)\b/i.test(`${email.subject} ${email.snippet} ${email.body}`)) {
      assignments.add(email.subject);
    }
  }

  return Array.from(assignments).slice(0, 8);
}

export function buildExamCountdowns(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  studyTasks: PlannerTaskRecord[],
) {
  const countdowns: string[] = [];
  const now = new Date();

  for (const task of studyTasks) {
    if (!/\b(exam|quiz|midterm|final|test)\b/i.test(task.title)) {
      continue;
    }
    const parsed = task.dueDate;
    if (!parsed) {
      continue;
    }
    const days = Math.max(0, Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24)));
    countdowns.push(`${task.title} - in ${days} day${days === 1 ? "" : "s"}`);
  }

  for (const { email, signals } of urgentEmails) {
    if (!/\b(exam|quiz|midterm|final|test)\b/i.test(`${email.subject} ${email.snippet}`)) {
      continue;
    }
    const parsed = parseDateFromFlexibleText(signals.deadlines[0] ?? "");
    if (!parsed) {
      continue;
    }
    const days = Math.max(0, Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24)));
    countdowns.push(`${email.subject} - in ${days} day${days === 1 ? "" : "s"}`);
  }

  return Array.from(new Set(countdowns)).slice(0, 6);
}

export function collectSchoolDeadlines(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  studyTasks: PlannerTaskRecord[],
) {
  const deadlines = new Set<string>();

  for (const task of studyTasks) {
    if (task.dueLabel) {
      deadlines.add(`${task.title} - ${task.dueLabel}`);
    }
  }

  for (const { email, signals } of urgentEmails) {
    for (const deadline of signals.deadlines.slice(0, 2)) {
      deadlines.add(`${email.subject} - ${deadline}`);
    }
  }

  return Array.from(deadlines).slice(0, 8);
}

export function buildSchoolPlanContent(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  files: FileRecord[],
) {
  const loadedPdfs = getLoadedPdfFiles(files);
  const urgentStudyEmails = emails
    .map(scoreEmailUrgency)
    .filter(({ email, signals, score }) => {
      const text = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
      return (
        /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project)\b/i.test(text) ||
        signals.deadlines.length > 0 ||
        score > 0
      );
    })
    .slice(0, 5);
  const studyTasks = tasks.filter((task) =>
    /\b(class|course|assignment|exam|quiz|study|homework|syllabus|lecture|project|school)\b/i.test(
      `${task.title} ${task.sourceNote.summary}`,
    ) || task.status === "today" || task.status === "overdue",
  );
  const focusSummary = buildSchoolFocusSummary(urgentStudyEmails, studyTasks, loadedPdfs);
  const subjects = detectSchoolSubjects(emails, studyTasks, loadedPdfs);
  const sessions = buildSchoolSessions(subjects, loadedPdfs, studyTasks, urgentStudyEmails);
  const deadlines = collectSchoolDeadlines(urgentStudyEmails, studyTasks);
  const assignments = extractSchoolAssignments(urgentStudyEmails, studyTasks);
  const examCountdowns = buildExamCountdowns(urgentStudyEmails, studyTasks);

  return [
    `School Mode Plan: ${new Date().toLocaleString()}`,
    "",
    focusSummary,
    "",
    "Subjects",
    ...(subjects.length > 0 ? subjects.map((subject) => `- ${subject}`) : ["- No clear subject detected yet."]),
    "",
    "Loaded study PDFs",
    ...(loadedPdfs.length > 0
      ? loadedPdfs.slice(0, 8).map((file) => `- ${file.name}`)
      : ["- No PDFs are loaded yet."]),
    "",
    "School-related tasks",
    ...(studyTasks.length > 0
      ? studyTasks.slice(0, 8).map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No school-related tasks are loaded yet."]),
    "",
    "School-related email",
    ...(urgentStudyEmails.length > 0
      ? urgentStudyEmails.map(({ email, signals }) => {
          const cues = [
            signals.deadlines.length > 0 ? `${signals.deadlines.length} deadline cue${signals.deadlines.length === 1 ? "" : "s"}` : "",
            signals.reminders.length > 0 ? `${signals.reminders.length} reminder cue${signals.reminders.length === 1 ? "" : "s"}` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `- ${email.subject} - ${email.from}${cues ? ` (${cues})` : ""}`;
        })
      : ["- No school-related loaded emails right now."]),
    "",
    "Deadlines",
    ...(deadlines.length > 0 ? deadlines.map((deadline) => `- ${deadline}`) : ["- No explicit school deadlines detected."]),
    "",
    "Assignments",
    ...(assignments.length > 0 ? assignments.map((assignment) => `- ${assignment}`) : ["- No school assignments detected yet."]),
    "",
    "Exam countdowns",
    ...(examCountdowns.length > 0 ? examCountdowns.map((item) => `- ${item}`) : ["- No exam countdowns detected yet."]),
    "",
    "Study sessions",
    ...(sessions.length > 0 ? sessions.map((session) => `- ${session}`) : ["- No study sessions suggested yet."]),
    "",
    "Suggested next moves",
    studyTasks.filter((task) => task.status === "overdue").length > 0
      ? `- Clear overdue work first: ${studyTasks
          .filter((task) => task.status === "overdue")
          .slice(0, 3)
          .map((task) => task.title)
          .join(", ")}`
      : "- No overdue school tasks detected.",
    loadedPdfs.length > 0
      ? `- Review ${loadedPdfs[0].name} next and make tasks from it if needed.`
      : "- Load a class PDF so JARVIS can summarize it or create tasks from it.",
    urgentStudyEmails.length > 0
      ? `- Check ${urgentStudyEmails[0].email.subject} for new deadlines or changes.`
      : "- Check recent school email for deadline updates if needed.",
  ].join("\n");
}

export function getNextBirthdayDate(person: PersonMemoryRecord, now = new Date()) {
  const year = now.getFullYear();
  const thisYear = new Date(year, person.month - 1, person.day);
  if (thisYear >= new Date(year, now.getMonth(), now.getDate())) {
    return thisYear;
  }

  return new Date(year + 1, person.month - 1, person.day);
}

export function formatUpcomingBirthday(person: PersonMemoryRecord, now = new Date()) {
  const nextBirthday = getNextBirthdayDate(person, now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (nextBirthday.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  const suffix =
    diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
  const extras = [
    formatPersonAge(person),
    person.relationship,
    (person.reminderLeadDays ?? 0) > 0
      ? `remind ${person.reminderLeadDays} day${person.reminderLeadDays === 1 ? "" : "s"} before`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${person.name} - ${person.birthdayLabel} (${suffix})${extras ? ` - ${extras}` : ""}`;
}

export function findPersonByQuery(people: PersonMemoryRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return people.find((entry) => entry.name.toLowerCase().includes(normalized)) ?? null;
}

export function getNextBirthdayCalendarWindow(person: PersonMemoryRecord, now = new Date()) {
  const nextBirthday = getNextBirthdayDate(person, now);
  const start = new Date(nextBirthday.getFullYear(), nextBirthday.getMonth(), nextBirthday.getDate(), 9, 0, 0, 0);
  const end = new Date(nextBirthday.getFullYear(), nextBirthday.getMonth(), nextBirthday.getDate(), 10, 0, 0, 0);
  return { start, end };
}

export function parseOptionalDateLabel(label: string | null | undefined) {
  if (!label) {
    return null;
  }

  return parseDateFromFlexibleText(label);
}

export function getUpcomingPeopleFollowUps(people: PersonMemoryRecord[], now = new Date()) {
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = startOfDay(now);

  return people
    .filter((person) => {
      const parsed = parseOptionalDateLabel(person.followUpDueLabel);
      if (!parsed) {
        return false;
      }
      return parsed.getTime() >= start.getTime() && parsed.getTime() <= weekAhead.getTime();
    })
    .sort((left, right) => {
      const leftDate = parseOptionalDateLabel(left.followUpDueLabel);
      const rightDate = parseOptionalDateLabel(right.followUpDueLabel);
      if (!leftDate || !rightDate) {
        return 0;
      }
      return leftDate.getTime() - rightDate.getTime();
    });
}

export function formatEmailSignals(email: EmailRecord, signals: EmailSignals) {
  const sections: Array<[string, string[]]> = [
    ["Deadlines", signals.deadlines],
    ["Birthdays", signals.birthdays],
    ["Meetings", signals.meetings],
    ["Addresses", signals.addresses],
    ["Reminders", signals.reminders],
  ];

  return [
    `Email extraction: ${email.subject}`,
    `From: ${email.from}`,
    email.date ? `Date: ${email.date}` : "",
    "",
    ...sections.flatMap(([label, items]) => [
      label,
      ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None detected"]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function cleanPdfText(text: string) {
  return text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function summarizePdfText(fileName: string, text: string) {
  const cleaned = cleanPdfText(text);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const selected = sentences.slice(0, 5);

  return [
    `PDF Summary: ${fileName}`,
    "",
    ...(selected.length > 0
      ? selected.map((sentence, index) => `${index + 1}. ${sentence}`)
      : ["No readable summary content was extracted."]),
  ].join("\n");
}

export function extractTasksFromPdfText(text: string): PdfTaskCandidate[] {
  const cleaned = cleanPdfText(text);
  const chunks = cleaned
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const taskCandidates = chunks.filter((sentence) =>
    /\b(submit|review|read|finish|complete|prepare|email|call|schedule|bring|study|revise|practice|write|update|upload)\b/i.test(sentence),
  );

  return Array.from(
    new Map(
      taskCandidates
        .slice(0, 6)
        .map((sentence) => sentence.replace(/^[\-\u2022\d.)\s]+/, "").replace(/\s+/g, " ").trim())
        .filter((sentence) => sentence.length > 8)
        .map((sentence) => {
          const dueLabel = extractDueLabel(sentence);
          const title = dueLabel
            ? sentence.replace(new RegExp(escapeRegExp(dueLabel), "i"), "").replace(/\s+/g, " ").trim()
            : sentence;

          const normalizedTitle = title.replace(/\bby\b$/i, "").trim();
          return [
            normalizedTitle.toLowerCase(),
            {
              title: normalizedTitle,
              dueLabel,
            } satisfies PdfTaskCandidate,
          ] as const;
        }),
    ).values(),
  ).filter((candidate) => candidate.title.length > 0);
}

export function formatPdfTextPreview(fileName: string, text: string) {
  const cleaned = cleanPdfText(text);
  return [
    `PDF Text: ${fileName}`,
    "",
    cleaned.slice(0, 4000) || "No readable PDF text was extracted.",
  ].join("\n");
}

export function getEmailByIndex(emails: EmailRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return emails[index - 1] ?? null;
}

export function getCurrentEmail(emails: EmailRecord[]) {
  return emails[0] ?? null;
}

export function createActiveEmailContext(email: EmailRecord): ActiveConversationContext {
  return {
    kind: "email",
    emailId: email.id,
    threadId: email.threadId,
    label: email.subject,
  };
}

export function getNoteByIndex(notes: NoteRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return notes[index - 1] ?? null;
}

export function createActiveNoteContext(note: NoteRecord): ActiveConversationContext {
  return {
    kind: "note",
    noteId: note.id,
    label: note.title,
    url: note.url,
  };
}

export function resolveActiveNote(
  context: ActiveConversationContext | null,
  notes: NoteRecord[],
) {
  if (!context || context.kind !== "note") {
    return null;
  }

  return notes.find((note) => note.id === context.noteId) ?? null;
}

export function createActiveTaskContext(task: PlannerTaskRecord): ActiveConversationContext {
  return {
    kind: "task",
    noteId: task.id,
    label: task.title,
    dueLabel: task.dueLabel,
  };
}

export function resolveActiveTask(
  context: ActiveConversationContext | null,
  tasks: PlannerTaskRecord[],
) {
  if (!context || context.kind !== "task") {
    return null;
  }

  return tasks.find((task) => task.id === context.noteId) ?? null;
}

export function createActiveBrowserContext(url: string): ActiveConversationContext {
  return {
    kind: "browser",
    url,
    label: formatBrowserTargetLabel(url),
  };
}

export function createActiveDesktopAppContext(appName: string): ActiveConversationContext {
  return {
    kind: "desktop_app",
    appName,
    label: appName,
  };
}

export function createActiveDesktopFolderContext(folderName: string): ActiveConversationContext {
  return {
    kind: "desktop_folder",
    folderName,
    label: folderName,
  };
}

export function createActiveDesktopWorkspaceContext(projectName: string): ActiveConversationContext {
  return {
    kind: "desktop_workspace",
    projectName,
    label: projectName,
  };
}

export function createActiveScreenshotContext(path: string): ActiveConversationContext {
  return {
    kind: "screenshot",
    path,
    label: path.split(/[\\/]/).pop() ?? "screenshot",
  };
}

export function resolveActiveBrowserContext(context: ActiveConversationContext | null) {
  return context?.kind === "browser" ? context : null;
}

export function resolveActiveEmail(
  context: ActiveConversationContext | null,
  emails: EmailRecord[],
) {
  if (!context || context.kind !== "email") {
    return null;
  }

  return emails.find((email) => email.id === context.emailId) ?? null;
}

export function resolveActivePdf(
  context: ActiveConversationContext | null,
  files: FileRecord[],
) {
  if (!context || context.kind !== "pdf") {
    return null;
  }

  return getLoadedPdfFiles(files).find((file) => file.path === context.path) ?? null;
}

export function findEmailByQuery(emails: EmailRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  return (
    emails.find((email) =>
      `${email.subject} ${email.from} ${email.snippet} ${email.body}`.toLowerCase().includes(normalizedQuery),
    ) ?? null
  );
}

export function parseDateFromEmailText(text: string) {
  const now = new Date();
  const relativeMatch = text.match(
    /\b(?:on\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );

  if (relativeMatch) {
    const day = resolveDayReference(relativeMatch[1], now);
    const clock = parseClockTime(relativeMatch[2]);
    if (day && clock) {
      return new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  const explicitMatch = text.match(
    /\b(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i,
  );

  if (explicitMatch) {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const monthIndex = monthNames.indexOf(explicitMatch[1].toLowerCase());
    const dayNumber = Number(explicitMatch[2]);
    const yearNumber = Number(explicitMatch[3] ?? now.getFullYear().toString());
    const clock = explicitMatch[4] ? parseClockTime(explicitMatch[4]) : { hours: 9, minutes: 0 };

    if (monthIndex >= 0 && clock) {
      return new Date(
        yearNumber,
        monthIndex,
        dayNumber,
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  const numericMatch = text.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i,
  );
  if (numericMatch) {
    const monthNumber = Number(numericMatch[1]) - 1;
    const dayNumber = Number(numericMatch[2]);
    const rawYear = numericMatch[3];
    const yearNumber = rawYear
      ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
      : now.getFullYear();
    const clock = numericMatch[4] ? parseClockTime(numericMatch[4]) : { hours: 9, minutes: 0 };

    if (monthNumber >= 0 && monthNumber <= 11 && clock) {
      return new Date(
        yearNumber,
        monthNumber,
        dayNumber,
        clock.hours,
        clock.minutes,
        0,
        0,
      );
    }
  }

  return null;
}

export function parseDateFromFlexibleText(text: string) {
  const direct = new Date(text.trim());
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  return parseDateFromEmailText(text);
}

export function parseTaskNoteRecord(note: NoteRecord): PlannerTaskRecord | null {
  const combined = `${note.title}\n${note.summary}`.trim();
  if (!combined.toLowerCase().includes("task:")) {
    return null;
  }

  const titleMatch =
    combined.match(/task:\s*(.+?)(?:\s*\|\s*due:|$)/i) ??
    combined.match(/task:\s*(.+)/i);
  const dueMatch = combined.match(/due:\s*(.+?)(?:\n|$)/i);
  const statusMatch = combined.match(/status:\s*(.+?)(?:\n|$)/i);
  const dueLabel = dueMatch?.[1]?.trim() ?? null;
  const dueDate = dueLabel ? parseDateFromFlexibleText(dueLabel) : null;
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addMinutes(todayStart, 24 * 60);

  let status: PlannerTaskRecord["status"] = "unscheduled";
  if (statusMatch?.[1]?.trim().toLowerCase() === "done") {
    status = "done";
  } else if (dueDate) {
    const dueDayStart = startOfDay(dueDate);
    if (dueDayStart.getTime() < todayStart.getTime()) {
      status = "overdue";
    } else if (dueDayStart.getTime() === todayStart.getTime()) {
      status = "today";
    } else if (dueDayStart.getTime() >= tomorrowStart.getTime()) {
      status = "upcoming";
    }
  }

  return {
    id: note.id,
    title: titleMatch?.[1]?.trim() || note.title,
    dueLabel,
    dueDate,
    status,
    sourceNote: note,
  };
}

export function buildCalendarIntentFromEmail(email: EmailRecord) {
  const combined = `${email.subject} ${email.snippet} ${email.body}`.trim();
  const start = parseDateFromEmailText(combined);
  if (!start) {
    return null;
  }

  const rangeMatch = combined.match(
    /\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  let end = addMinutes(start, 60);
  if (rangeMatch) {
    const endClock = parseClockTime(rangeMatch[2]);
    if (endClock) {
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        endClock.hours,
        endClock.minutes,
        0,
        0,
      );
      if (end <= start) {
        end = addMinutes(start, 60);
      }
    }
  }

  const cleanedTitle = email.subject
    .replace(/\b(invite|invitation|event|meeting)\b[:\-\s]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    kind: "create_calendar_event" as const,
    title: cleanedTitle || email.subject || "Email event",
    start,
    end,
  };
}

export function formatEmailDigestForNotion(emails: EmailRecord[]) {
  return [
    `Email Digest: ${new Date().toLocaleString()}`,
    "",
    ...emails.flatMap((email, index) => [
      `${index + 1}. ${email.subject}`,
      `From: ${email.from}`,
      email.date ? `Date: ${email.date}` : "",
      email.snippet || "No preview available.",
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function getDueIsoFromLabel(dueLabel: string | null) {
  if (!dueLabel) {
    return null;
  }

  const parsed = parseDateFromFlexibleText(dueLabel);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString();
}

export function getPlannerTaskByIndex(tasks: PlannerTaskRecord[], index: number) {
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  return tasks[index - 1] ?? null;
}

export function findPlannerTaskByQuery(tasks: PlannerTaskRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    tasks.find((task) =>
      `${task.title} ${task.dueLabel ?? ""} ${task.sourceNote.summary}`.toLowerCase().includes(normalized),
    ) ?? null
  );
}

export function formatPlannerTaskList(tasks: PlannerTaskRecord[], emptyMessage: string) {
  return tasks.length > 0
    ? tasks
        .map((task) => `${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
        .join(" | ")
    : emptyMessage;
}

export function buildClarificationReply(prompt: string) {
  return prompt;
}

export function buildMissingSkillReply() {
  return "I get what you're asking, but I do not have that skill wired yet. Right now I can handle study setup, website opening, Google searches, Notion notes, calendar actions, reminder drafts, local file search, Spotify playback control, and Gmail inbox reads.";
}

export function formatCalendarEventTimeLabel(value: string | null) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getEventBucketLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const hour = date.getHours();
  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  return "Evening";
}

export function scoreEmailUrgency(email: EmailRecord) {
  const signals = extractEmailSignals(email);
  const lowered = `${email.subject} ${email.snippet} ${email.body}`.toLowerCase();
  let score = 0;

  score += signals.deadlines.length * 3;
  score += signals.meetings.length * 2;
  score += signals.reminders.length * 2;
  score += signals.birthdays.length;

  if (/\b(urgent|asap|important|action required|deadline|overdue|final reminder)\b/i.test(lowered)) {
    score += 4;
  }

  return { email, signals, score };
}

export function buildFocusSummary(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  overdueTasks: PlannerTaskRecord[],
  todayTasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
) {
  const focusPoints: string[] = [];

  if (overdueTasks.length > 0) {
    focusPoints.push(
      `clear ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} first`,
    );
  }

  if (urgentEmails.length > 0) {
    focusPoints.push(
      `review ${urgentEmails.length} urgent email${urgentEmails.length === 1 ? "" : "s"}`,
    );
  }

  if (events.length > 0) {
    focusPoints.push(
      `prepare for ${events.length} calendar event${events.length === 1 ? "" : "s"} today`,
    );
  }

  if (todayTasks.length > 0) {
    focusPoints.push(
      `finish ${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} due today`,
    );
  }

  if (focusPoints.length === 0) {
    return "Focus today: keep momentum steady. There are no urgent blockers showing right now.";
  }

  return `Focus today: ${focusPoints.join(", ")}.`;
}

export function buildTopPriorities(
  urgentEmails: Array<{ email: EmailRecord; signals: EmailSignals; score: number }>,
  overdueTasks: PlannerTaskRecord[],
  packages: PackageMemoryRecord[],
  people: PersonMemoryRecord[],
) {
  const items: string[] = [];

  if (overdueTasks.length > 0) {
    items.push(`Clear overdue task: ${overdueTasks[0].title}`);
  }
  if (urgentEmails.length > 0) {
    items.push(`Review urgent email: ${urgentEmails[0].email.subject}`);
  }
  const arrivingToday = packages.find((item) => item.arrivingToday);
  if (arrivingToday) {
    items.push(`Watch delivery: ${arrivingToday.title}`);
  }
  const followUp = getUpcomingPeopleFollowUps(people)[0];
  if (followUp) {
    items.push(`Check in with ${followUp.name}`);
  }

  return items.slice(0, 3);
}

export function buildProactiveSuggestions(
  schoolPlans: SchoolPlanMemoryRecord[],
  packages: PackageMemoryRecord[],
  meetingPrep: MeetingPrepMemoryRecord[],
  expenses: ExpenseMemoryRecord[],
) {
  const suggestions: string[] = [];
  const tomorrowPackage = packages.find((item) => item.arrivingTomorrow);
  const delayedPackage = packages.find((item) => /\bdelayed\b/i.test(item.status ?? ""));
  const recurringExpense = expenses.find((item) => item.recurringLikely);

  if (tomorrowPackage) {
    suggestions.push(`Watch for ${tomorrowPackage.title} tomorrow.`);
  }
  if (delayedPackage) {
    suggestions.push(`Recheck the delayed shipment for ${delayedPackage.title}.`);
  }
  if (meetingPrep.length > 0) {
    suggestions.push(`Open your latest prep note for ${meetingPrep[0].eventTitle}.`);
  }
  if (schoolPlans.length > 0) {
    suggestions.push(`Use your latest school plan for ${schoolPlans[0].subjects[0] ?? "today's study block"}.`);
  }
  if (recurringExpense) {
    suggestions.push(`Review the recurring charge from ${recurringExpense.merchant ?? recurringExpense.title}.`);
  }

  if (suggestions.length === 0) {
    suggestions.push("Keep the day simple and only open the next item when you need it.");
  }

  return suggestions.slice(0, 4);
}

export function buildDailyBriefContent(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
) {
  const todayTasks = tasks.filter((task) => task.status === "today");
  const upcomingTasks = tasks.filter((task) => task.status === "upcoming").slice(0, 5);

  return [
    `Daily Brief: ${new Date().toLocaleString()}`,
    "",
    "Calendar",
    ...(events.length > 0
      ? events.map(
          (event) =>
            `- ${event.summary} (${formatCalendarEventTimeLabel(event.start)}${
              event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
            })`,
        )
      : ["- No events scheduled today."]),
    "",
    "Unread / loaded email",
    ...(emails.length > 0
      ? emails.slice(0, 5).map((email) => `- ${email.subject} — ${email.from}`)
      : ["- No unread or loaded emails right now."]),
    "",
    "Today's tasks",
    ...(todayTasks.length > 0
      ? todayTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No tasks due today."]),
    "",
    "Upcoming tasks",
    ...(upcomingTasks.length > 0
      ? upcomingTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No upcoming tasks loaded."]),
  ].join("\n");
}

export function buildDailyBriefContentV4(
  emails: EmailRecord[],
  tasks: PlannerTaskRecord[],
  events: GoogleCalendarEventRecord[],
  people: PersonMemoryRecord[],
  travel: TravelMemoryRecord[],
  expenses: ExpenseMemoryRecord[],
  packages: PackageMemoryRecord[],
  meetingPrep: MeetingPrepMemoryRecord[],
  schoolPlans: SchoolPlanMemoryRecord[],
) {
  const overdueTasks = tasks.filter((task) => task.status === "overdue");
  const todayTasks = tasks.filter((task) => task.status === "today");
  const upcomingTasks = tasks.filter((task) => task.status === "upcoming").slice(0, 5);
  const prioritizedEmails = emails
    .map(scoreEmailUrgency)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const urgentEmails = prioritizedEmails.filter((entry) => entry.score > 0);
  const groupedEvents = {
    Morning: events.filter((event) => getEventBucketLabel(event.start) === "Morning"),
    Afternoon: events.filter((event) => getEventBucketLabel(event.start) === "Afternoon"),
    Evening: events.filter((event) => getEventBucketLabel(event.start) === "Evening"),
  };
  const focusSummary = buildFocusSummary(urgentEmails, overdueTasks, todayTasks, events);
  const upcomingBirthdays = [...people]
    .sort((left, right) => getNextBirthdayDate(left).getTime() - getNextBirthdayDate(right).getTime())
    .slice(0, 3);
  const arrivingToday = packages.filter((item) => item.arrivingToday).slice(0, 5);
  const arrivingTomorrow = packages.filter((item) => item.arrivingTomorrow).slice(0, 3);
  const recentTrips = travel.slice(0, 3);
  const monthlyExpenseTotal = expenses.reduce<number | null>((sum, item) => {
    if (item.amountValue === null) {
      return sum;
    }
    return (sum ?? 0) + item.amountValue;
  }, 0);
  const recurringExpenses = expenses.filter((item) => item.recurringLikely).slice(0, 3);
  const recentMeetingPrep = meetingPrep.slice(0, 2);
  const recentSchoolPlans = schoolPlans.slice(0, 2);
  const topPriorities = buildTopPriorities(urgentEmails, overdueTasks, packages, people);
  const proactiveSuggestions = buildProactiveSuggestions(schoolPlans, packages, meetingPrep, expenses);

  return [
    `Daily Brief: ${new Date().toLocaleString()}`,
    "",
    focusSummary,
    "",
    "Top 3 priorities",
    ...(topPriorities.length > 0
      ? topPriorities.map((item, index) => `- ${index + 1}. ${item}`)
      : ["- No top priorities detected right now."]),
    "",
    "Upcoming birthdays",
    ...(upcomingBirthdays.length > 0
      ? upcomingBirthdays.map((person) => `- ${formatUpcomingBirthday(person)}`)
      : ["- No saved birthdays coming up soon."]),
    "",
    "Packages arriving today",
    ...(arrivingToday.length > 0
      ? arrivingToday.map(
          (item) =>
            `- ${item.title}${item.status ? ` (${item.status})` : ""}${item.deliveryDate ? ` - ${item.deliveryDate}` : ""}`,
        )
      : ["- No packages marked as arriving today."]),
    "",
    "Packages arriving tomorrow",
    ...(arrivingTomorrow.length > 0
      ? arrivingTomorrow.map(
          (item) =>
            `- ${item.title}${item.itemLabel ? ` - ${item.itemLabel}` : ""}${item.deliveryDate ? ` - ${item.deliveryDate}` : ""}`,
        )
      : ["- No packages marked as arriving tomorrow."]),
    "",
    "Travel in motion",
    ...(recentTrips.length > 0
      ? recentTrips.map(
          (item) =>
            `- ${item.title}${item.departure ? ` - ${item.departure}` : ""}${item.hotel ? ` - ${item.hotel}` : ""}`,
        )
      : ["- No saved travel plans yet."]),
    "",
    "Urgent email",
    ...(prioritizedEmails.length > 0
      ? prioritizedEmails.map(({ email, signals, score }) => {
          const reasons = [
            signals.deadlines.length > 0
              ? `${signals.deadlines.length} deadline signal${signals.deadlines.length === 1 ? "" : "s"}`
              : "",
            signals.meetings.length > 0
              ? `${signals.meetings.length} meeting signal${signals.meetings.length === 1 ? "" : "s"}`
              : "",
            signals.reminders.length > 0
              ? `${signals.reminders.length} reminder signal${signals.reminders.length === 1 ? "" : "s"}`
              : "",
          ]
            .filter(Boolean)
            .join(", ");

          return `- ${email.subject} — ${email.from}${reasons ? ` (${reasons})` : score > 0 ? " (priority)" : ""}`;
        })
      : ["- No unread or loaded emails right now."]),
    "",
    "Calendar",
    ...(events.length > 0
      ? (["Morning", "Afternoon", "Evening"] as const).flatMap((bucket) => [
          bucket,
          ...(groupedEvents[bucket].length > 0
            ? groupedEvents[bucket].map(
                (event) =>
                  `- ${event.summary} (${formatCalendarEventTimeLabel(event.start)}${
                    event.end ? ` to ${formatCalendarEventTimeLabel(event.end)}` : ""
                  })`,
              )
            : ["- Nothing scheduled."]),
          "",
        ])
      : ["- No events scheduled today."]),
    "Overdue tasks",
    ...(overdueTasks.length > 0
      ? overdueTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No overdue tasks."]),
    "",
    "Tasks due today",
    ...(todayTasks.length > 0
      ? todayTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No tasks due today."]),
    "",
    "Upcoming tasks",
    ...(upcomingTasks.length > 0
      ? upcomingTasks.map((task) => `- ${task.title}${task.dueLabel ? ` (${task.dueLabel})` : ""}`)
      : ["- No upcoming tasks loaded."]),
    "",
    "Expense snapshot",
    ...(expenses.length > 0
      ? [
          monthlyExpenseTotal !== null
            ? `- Saved expense total in memory: $${monthlyExpenseTotal.toFixed(2)}`
            : "- Saved expenses do not have enough amount data yet.",
          ...(recurringExpenses.length > 0
            ? recurringExpenses.map(
                (item) => `- Recurring: ${item.title}${item.amount ? ` (${item.amount})` : ""}${item.category ? ` - ${item.category}` : ""}`,
              )
            : []),
          ...expenses.slice(0, 3).map(
            (item) => `- ${item.title}${item.amount ? ` (${item.amount})` : ""}${item.category ? ` - ${item.category}` : ""}`,
          ),
        ]
      : ["- No saved expenses yet."]),
    "",
    "Meeting prep memory",
    ...(recentMeetingPrep.length > 0
      ? recentMeetingPrep.map((item) => `- ${item.summaryTitle}${item.focusSummary ? ` - ${item.focusSummary}` : ""}`)
      : ["- No recent meeting prep summaries yet."]),
    "",
    "School mode memory",
    ...(recentSchoolPlans.length > 0
      ? recentSchoolPlans.map(
          (item) =>
            `- ${item.title}${item.subjects.length > 0 ? ` - ${item.subjects.join(", ")}` : ""}${
              item.examCountdowns.length > 0 ? ` - exams: ${item.examCountdowns.join(", ")}` : ""
            }`,
        )
      : ["- No recent school mode plans yet."]),
    "",
    "Proactive suggestions",
    ...proactiveSuggestions.map((item) => `- ${item}`),
  ].join("\n");
}

export function buildFailureReply() {
  return "I tried that, but I could not complete the action through the desktop bridge.";
}

export function mapOllamaInterpretationToResult(
  interpretation: ConversationInterpretation,
): ModelInterpretationResult {
  if (interpretation.kind === "study_setup") {
    return { kind: "intent", intent: { kind: "study_setup" } };
  }

  if (interpretation.kind === "google_search") {
    return {
      kind: "intent",
      intent: { kind: "google_search", query: interpretation.query ?? "" },
    };
  }

  if (interpretation.kind === "open_url" && interpretation.url) {
    return {
      kind: "intent",
      intent: { kind: "open_url", url: interpretation.url },
    };
  }

  if (interpretation.kind === "needs_clarification") {
    return {
      kind: "clarification",
      prompt:
        interpretation.clarificationPrompt ??
        "I need a little clarification before I do that.",
    };
  }

  return { kind: "unsupported" };
}

export function resolveBrowserAliasTarget(target: string, aliases: BrowserAliasRecord[]) {
  const normalizedTarget = target.trim().toLowerCase();
  const learnedAlias = aliases.find(
    (alias) => alias.phrase.trim().toLowerCase() === normalizedTarget,
  );

  if (learnedAlias) {
    return canonicalizeBrowserUrl(learnedAlias.url);
  }

  return builtInBrowserAliases[normalizedTarget] ?? null;
}

export function isKnownBrowserTarget(target: string, aliases: BrowserAliasRecord[]) {
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) {
    return false;
  }

  return (
    Boolean(builtInBrowserAliases[normalizedTarget]) ||
    aliases.some((alias) => alias.phrase.trim().toLowerCase() === normalizedTarget)
  );
}

export function hasExplicitSearchLanguage(command: string) {
  return /\b(search|look up|find .* on google)\b/i.test(command);
}

export function hasExplicitOpenLanguage(command: string) {
  return /\b(open|launch)\b/i.test(command);
}

export function shouldUseOllamaFirstInAutoMode(command: string) {
  const trimmed = command.trim();
  if (!trimmed) {
    return false;
  }

  return /^(?:can you|could you|would you|please|help me|i want|i need|what should|how should|figure out|make this|turn this|summarize this|explain this)/i.test(
    trimmed,
  );
}

export function describeCommandIntent(intent: CommandIntent | null) {
  if (!intent) {
    return "No supported intent matched.";
  }

  switch (intent.kind) {
    case "study_setup":
      return "Study setup";
    case "google_search":
      return `Google search: ${intent.query}`;
    case "open_url":
      return `Open URL: ${intent.url}`;
    case "create_note":
      return `Create note: ${intent.content.slice(0, 80)}`;
    case "read_screen_text":
      return "Read screen text";
    case "summarize_screen":
      return `Summarize screen (${intent.mode})`;
    case "run_project_checks":
      return "Run project checks";
    case "open_project_in_vscode":
      return "Open project in VS Code";
    case "list_unread_emails":
      return "List unread emails";
    case "spotify_play_query":
      return `Play on Spotify: ${intent.query}`;
    case "spotify_play_artist":
      return `Play Spotify artist: ${intent.query}`;
    case "spotify_play_playlist":
      return `Play Spotify playlist: ${intent.query}`;
    case "spotify_play_album":
      return `Play Spotify album: ${intent.query}`;
    case "spotify_queue_query":
      return `Queue on Spotify: ${intent.query}`;
    case "spotify_like_current":
      return "Save current Spotify track";
    case "spotify_status":
      return "Spotify status";
    case "set_conversation_backend":
      return `Switch brain to ${intent.backend}`;
    case "test_model_provider":
      return `Test ${MODEL_PROVIDER_LABELS[intent.providerId]}`;
    case "generate_model_draft":
      return `Generate model draft: ${intent.prompt.slice(0, 80)}`;
    case "explain_model_route":
      return `Explain model route: ${intent.prompt.slice(0, 80)}`;
    case "copy_latest_model_draft":
      return "Copy latest model draft";
    case "save_latest_model_draft_to_notion":
      return "Save latest model draft to Notion";
    case "run_model_benchmark":
      return "Run model benchmark";
    case "compare_model_responses":
      return `Compare model responses: ${intent.prompt.slice(0, 80)}`;
    case "choose_model_comparison_winner":
      return `Choose ${MODEL_PROVIDER_LABELS[intent.providerId]} as comparison winner`;
    case "recommend_model_routes":
      return "Recommend model routes";
    case "set_model_provider_for_task":
      return `Use ${MODEL_PROVIDER_LABELS[intent.providerId]} for ${intent.taskType}`;
    case "set_private_model_mode":
      return intent.localOnly ? "Enable local-only private mode" : "Allow cloud private mode";
    default:
      return intent.kind.replace(/_/g, " ");
  }
}

export function describeIntentActionType(intent: CommandIntent | null) {
  if (!intent) {
    return "none";
  }

  switch (intent.kind) {
    case "google_search":
      return "search";
    case "spotify_play_query":
    case "spotify_play_artist":
    case "spotify_play_playlist":
    case "spotify_play_album":
      return "play";
    case "spotify_queue_query":
      return "queue";
    case "spotify_like_current":
      return "save";
    case "open_url":
    case "open_project_in_vscode":
    case "launch_desktop_app":
    case "open_named_folder":
      return "open";
    case "create_note":
    case "create_task_note":
    case "create_calendar_event":
      return "create";
    case "set_conversation_backend":
    case "set_shell_bar":
    case "set_cockpit_mode":
    case "set_home_app":
      return "switch";
    case "test_model_provider":
      return "test";
    case "generate_model_draft":
      return "draft";
    case "explain_model_route":
      return "route";
    case "copy_latest_model_draft":
      return "copy";
    case "save_latest_model_draft_to_notion":
      return "save";
    case "run_model_benchmark":
      return "test";
    case "compare_model_responses":
      return "compare";
    case "choose_model_comparison_winner":
    case "set_model_provider_for_task":
    case "set_private_model_mode":
      return "switch";
    case "recommend_model_routes":
      return "recommend";
    default:
      return "action";
  }
}

