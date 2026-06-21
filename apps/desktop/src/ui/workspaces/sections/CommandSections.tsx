import { ReactNode } from "react";
import {
  decodeLearnedIntent,
  describeCommandIntent,
  formatGatewayPreview,
  formatIntentConfidenceLabel,
  toTitleCase,
} from "../../../features/legacy/appHelpers";
import type { CommandSectionProps } from "./sectionTypes";
import { buildPlannerCopilotCard } from "./PlannerSections";

export function buildCommandWorkspaceSections({
  activeConversationContext,
  assistantName,
  browserAliases,
  commandResult,
  conversationContextStack,
  conversationTurns,
  followUpWindow,
  embeddingBackend,
  embeddingModelName,
  embeddingStatusMessage,
  googleCalendarAccessToken,
  gatewayFollowUp,
  gatewayHistory,
  gatewayPreviewError,
  localRecorderRef,
  pendingGatewayConfirmation,
  pendingGatewayTeaching,
  handleDeleteLearnedIntent,
  handleDeleteWorkflow,
  handleRenameLearnedIntent,
  handleRenameWorkflow,
  handleVoiceStart,
  input,
  isPreviewingGateway,
  isRoutingCommand,
  lastConversationTopic,
  lastSemanticIntentMatches,
  learnedIntentFamilies,
  learnedIntentMappings,
  learnedIntentRenameDrafts,
  notionStatus,
  pendingClarification,
  plannerTasks,
  quickPrompts,
  recentEmails,
  recentFiles,
  recentHistory,
  recentNotes,
  routeCommand,
  runCommand,
  savedWorkflows,
  semanticConversationMemory,
  semanticIntentFeedback,
  setInput,
  setLearnedIntentRenameDrafts,
  setVoiceResponseEnabled,
  setWorkflowRenameDrafts,
  trainingModeSession,
  userPreferenceMemory,
  visibleGatewayPreview,
  voiceBackend,
  voiceCorrections,
  voiceResponseEnabled,
  voiceSessionPhase,
  voiceState,
  voiceTranscript,
  workflowRenameDrafts,
}: CommandSectionProps): ReactNode[] {
  return [
    <section className="command-panel" key="command-center">
      <div>
        <p className="section-kicker">Command Center</p>
        <h2>Start with natural commands</h2>
      </div>
      <form className="command-box" onSubmit={routeCommand}>
        <label>
          <span className="sr-only">Command input</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tell JARVIS what you want to do..."
          />
        </label>
        <button className="primary-button" type="submit" disabled={isRoutingCommand}>
          {isRoutingCommand ? "Routing..." : "Route command"}
        </button>
      </form>
      <div className="gateway-preview-card">
        <span className="gateway-preview-label">Gateway preview</span>
        <span className="gateway-preview-route">
          {isPreviewingGateway
            ? "Thinking..."
            : formatGatewayPreview(visibleGatewayPreview) ?? "Type a command to preview the route."}
        </span>
        {visibleGatewayPreview?.result.route ? (
          <span className="gateway-preview-reason">
            {visibleGatewayPreview.result.route.decisionReason} Score: {visibleGatewayPreview.result.route.score}
          </span>
        ) : gatewayPreviewError ? (
          <span className="gateway-preview-reason warning">{gatewayPreviewError}</span>
        ) : null}
      </div>
      {gatewayFollowUp ? (
        <div className={`gateway-followup-card ${visibleGatewayPreview?.result.route?.decisionPolicy ?? ""}`}>
          <p className="section-kicker">
            {visibleGatewayPreview?.result.route?.decisionPolicy === "teach"
              ? "Teaching prompt"
              : "Confirmation prompt"}
          </p>
          <h3>
            {visibleGatewayPreview?.result.route?.decisionPolicy === "teach"
              ? pendingGatewayTeaching
                ? "Waiting for teaching"
                : "JARVIS would ask to learn this"
              : pendingGatewayConfirmation
              ? "Waiting for yes or no"
              : "JARVIS would confirm first"}
          </h3>
          <p>{gatewayFollowUp}</p>
        </div>
      ) : null}
      <div className="voice-row">
        <button className="secondary-button" type="button" onClick={handleVoiceStart}>
          {voiceBackend === "local"
            ? localRecorderRef.current
              ? "Stop local recording"
              : "Start local recording"
            : voiceBackend === "groq"
            ? localRecorderRef.current
              ? "Stop Groq recording"
              : "Start Groq recording"
            : voiceState === "wake_listening"
            ? `Wake armed for ${assistantName}`
            : voiceState === "listening"
            ? "Listening..."
            : "Push to talk"}
        </button>
        <span className="memory-meta">
          {voiceTranscript
            ? `Heard: ${voiceTranscript}`
            : followUpWindow?.active
            ? "Follow-up window is open."
            : "Use voice or text naturally."}
        </span>
        <span className={`voice-phase ${voiceSessionPhase}`}>State: {voiceSessionPhase}</span>
        <button className="secondary-button" type="button" onClick={() => setVoiceResponseEnabled((current) => !current)}>
          {voiceResponseEnabled ? "Voice replies on" : "Voice replies off"}
        </button>
      </div>
      <div className="prompt-row">
        {quickPrompts.slice(0, 12).map((prompt) => (
          <button key={prompt} className="prompt-chip" type="button" onClick={() => setInput(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      {commandResult ? (
        <div className="result-card">
          <p className="section-kicker">Latest Result</p>
          <h3>{commandResult.title}</h3>
          {commandResult.routeLabel ? (
            <p className="result-meta">Routed via: {commandResult.routeLabel}</p>
          ) : null}
          <p>{commandResult.detail}</p>
        </div>
      ) : null}
      {trainingModeSession ? (
        <div className="result-card">
          <p className="section-kicker">Training Mode</p>
          <h3>
            Example {trainingModeSession.currentIndex} of {trainingModeSession.targetCount}
          </h3>
          <p>
            {trainingModeSession.phase === "awaiting_phrase"
              ? "Give JARVIS a phrase you naturally say."
              : `Phrase captured: "${trainingModeSession.pendingPhrase}". Now say what it should mean.`}
          </p>
          <p className="result-meta">
            Saved: {trainingModeSession.learnedExamples.length} | Say cancel training to stop.
          </p>
        </div>
      ) : null}
      {pendingClarification?.suggestedLearning ? (
        <div className="result-card">
          <p className="section-kicker">Intent Family Suggestion</p>
          <h3>Possible phrase match</h3>
          <p>
            "{pendingClarification.suggestedLearning.originalPhrase}" sounds close to your learned
            phrase "{pendingClarification.suggestedLearning.sourcePhrase}".
          </p>
          <p className="result-meta">
            Family: {pendingClarification.suggestedLearning.familyLabel} | Confidence:{" "}
            {Math.round(pendingClarification.suggestedLearning.confidenceScore * 100)}% | Learned
            phrases in family: {pendingClarification.suggestedLearning.familyPhraseCount}
          </p>
        </div>
      ) : null}
      {pendingClarification?.suggestedWorkflow ? (
        <div className="result-card">
          <p className="section-kicker">Semantic Workflow Suggestion</p>
          <h3>{pendingClarification.suggestedWorkflow.workflowName}</h3>
          <p>
            JARVIS thinks "{pendingClarification.originalPhrase}" may mean this saved workflow.
            Say yes to run it, no to weaken this match, or teach a better meaning.
          </p>
          <p className="result-meta">
            Trigger: {pendingClarification.suggestedWorkflow.triggerPhrase} | Confidence:{" "}
            {Math.round(pendingClarification.suggestedWorkflow.confidenceScore * 100)}%
          </p>
        </div>
      ) : null}
      {learnedIntentMappings.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Language Memory</p>
          <h3>{learnedIntentMappings.length} learned phrase{learnedIntentMappings.length === 1 ? "" : "s"}</h3>
          <p className="result-meta">
            Recent examples: {learnedIntentMappings.slice(0, 3).map((entry) => `"${entry.phrase}"`).join(", ")}
          </p>
          <p className="result-meta">
            Intent families: {learnedIntentFamilies.length}
            {learnedIntentFamilies[0]
              ? ` | Strongest family: ${learnedIntentFamilies[0].label} (${learnedIntentFamilies[0].phraseCount} phrase${learnedIntentFamilies[0].phraseCount === 1 ? "" : "s"})`
              : ""}
          </p>
          <p className="result-meta">
            Teach me directly with: `when I say open my setup, I mean open coding workspace`
          </p>
        </div>
      ) : null}
      <div className="result-card">
        <p className="section-kicker">Gateway History</p>
        <h3>Recent route decisions</h3>
        {gatewayHistory.length > 0 ? (
          <div className="gateway-history-list">
            {gatewayHistory.map((entry) => (
              <article className={`gateway-history-item ${entry.kind}`} key={entry.id}>
                <div>
                  <strong>{entry.capabilityLabel}</strong>
                  <span>{entry.command}</span>
                </div>
                <p>{entry.detail}</p>
                <small>
                  {toTitleCase(entry.kind)} | {toTitleCase(entry.decisionPolicy)} |{" "}
                  {toTitleCase(entry.confidence)} | {entry.createdAt}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="result-meta">
            Route a command to start collecting gateway previews, confirmations, and teaching events.
          </p>
        )}
      </div>
      <div className="result-card">
        <p className="section-kicker">Training Review</p>
        <h3>Review learned examples</h3>
        <p className="result-meta">
          Learned phrases: {learnedIntentMappings.length} | Saved workflows: {savedWorkflows.length}
        </p>
        {learnedIntentMappings.length > 0 ? (
          <div className="memory-list compact">
            {learnedIntentMappings.slice(0, 6).map((record) => {
              const intent = decodeLearnedIntent(record);
              return (
                <div className="memory-card" key={record.id}>
                  <h3>{record.phrase}</h3>
                  <p className="memory-meta">
                    {intent ? describeCommandIntent(intent) : record.intentKind} | used {record.useCount} time{record.useCount === 1 ? "" : "s"}
                  </p>
                  <div className="workflow-actions">
                    <input
                      value={learnedIntentRenameDrafts[record.id] ?? record.phrase}
                      onChange={(event) =>
                        setLearnedIntentRenameDrafts((current) => ({
                          ...current,
                          [record.id]: event.target.value,
                        }))
                      }
                    />
                    <button className="secondary-button" type="button" onClick={() => void handleRenameLearnedIntent(record)}>
                      Rename
                    </button>
                    <button className="secondary-button danger" type="button" onClick={() => void handleDeleteLearnedIntent(record)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="result-meta">No learned phrases yet. Say start training mode to add examples.</p>
        )}
        {savedWorkflows.length > 0 ? (
          <div className="memory-list compact">
            {savedWorkflows.slice(0, 6).map((workflow) => (
              <div className="memory-card" key={workflow.id}>
                <h3>{workflow.name}</h3>
                <p className="memory-meta">
                  Trigger: {workflow.triggerPhrase} | {workflow.steps.length} step{workflow.steps.length === 1 ? "" : "s"}
                </p>
                <div className="workflow-actions">
                  <input
                    value={workflowRenameDrafts[workflow.id] ?? workflow.triggerPhrase}
                    onChange={(event) =>
                      setWorkflowRenameDrafts((current) => ({
                        ...current,
                        [workflow.id]: event.target.value,
                      }))
                    }
                  />
                  <button className="secondary-button" type="button" onClick={() => handleRenameWorkflow(workflow)}>
                    Rename trigger
                  </button>
                  <button className="secondary-button danger" type="button" onClick={() => handleDeleteWorkflow(workflow)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="result-card">
        <p className="section-kicker">Preference Memory</p>
        <h3>Current defaults</h3>
        <p className="result-meta">
          Notes: {userPreferenceMemory.noteApp} | Music: {userPreferenceMemory.musicProvider ?? "not learned"} | Setup workspace: {userPreferenceMemory.defaultWorkspaceName ?? "not learned"}
        </p>
        <p className="result-meta">
          Last topic: {lastConversationTopic ? `${lastConversationTopic.intentLabel} (${lastConversationTopic.actionType})` : "none yet"}
        </p>
        <p className="result-meta">
          Context stack: {conversationContextStack.length > 0 ? conversationContextStack.slice(0, 4).map((entry) => entry.label).join(" -> ") : "empty"}
        </p>
      </div>
      <div className="result-card">
        <p className="section-kicker">Semantic Conversation Memory</p>
        <h3>{semanticConversationMemory.length} topic memory item{semanticConversationMemory.length === 1 ? "" : "s"}</h3>
        <p className="result-meta">
          Current topic: {activeConversationContext?.label ?? semanticConversationMemory[0]?.summary ?? "none yet"}
        </p>
        <p className="result-meta">
          Embeddings:{" "}
          {embeddingBackend === "ollama"
            ? `Ollama (${embeddingModelName || "nomic-embed-text"})`
            : embeddingBackend === "transformers"
            ? `Transformers.js (${embeddingModelName || "Xenova/all-MiniLM-L6-v2"})`
            : "local fallback"}{" "}
          | {embeddingStatusMessage}
        </p>
      </div>
      <div className="result-card">
        <p className="section-kicker">Semantic Brain</p>
        <h3>Foundation matching</h3>
        <p className="result-meta">
          Feedback memory: {semanticIntentFeedback.length} correction{semanticIntentFeedback.length === 1 ? "" : "s"} |{" "}
          Accepted: {semanticIntentFeedback.filter((entry) => entry.accepted).length} | Rejected:{" "}
          {semanticIntentFeedback.filter((entry) => !entry.accepted).length}
        </p>
        {lastSemanticIntentMatches.length > 0 ? (
          <div className="memory-list compact">
            {lastSemanticIntentMatches.map((match) => (
              <div className="memory-card" key={match.id}>
                <h3>{match.label}</h3>
                <p className="memory-meta">
                  {match.source} | {Math.round(match.score * 100)}% | {formatIntentConfidenceLabel(match.confidence)}
                </p>
                <p className="memory-meta">Matched example: {match.matchedExample}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="result-meta">
            Run a fuzzy command like "put this in my tasks" to see the top semantic matches here.
          </p>
        )}
      </div>
    </section>,
    <section className="grid-layout single-column" key="command-runtime">
      <article className="glass-panel">
        <p className="section-kicker">Conversation Thread</p>
        <h2>Recent back-and-forth</h2>
        <div className="conversation-list">
          {conversationTurns.map((turn) => (
            <div className={`conversation-card ${turn.role}`} key={turn.id}>
              <span className="conversation-role">{turn.role === "jarvis" ? "Jarvis" : "You"}</span>
              {turn.routeLabel ? <span className="conversation-route">{turn.routeLabel}</span> : null}
              <p>{turn.text}</p>
            </div>
          ))}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Activity History</p>
        <h2>What JARVIS has seen</h2>
        <div className="memory-list">
          {recentHistory.length > 0 ? recentHistory.map((entry) => (
            <div className="memory-card" key={entry.id}>
              <h3>{entry.rawCommand}</h3>
              <p>{entry.executedActions}</p>
              <span className="memory-meta">
                Intent: {entry.resolvedIntent} | Status: {entry.actionStatus} | {entry.createdAt}
              </span>
            </div>
          )) : <p className="empty-state">No actions logged yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Voice Memory</p>
        <h2>Learned transcript corrections</h2>
        <div className="memory-list">
          {voiceCorrections.length > 0 ? voiceCorrections.map((correction) => (
            <div className="memory-card" key={correction.id}>
              <h3>{correction.heardPhrase}</h3>
              <p>{correction.correctedPhrase}</p>
              <span className="memory-meta">Saved: {correction.createdAt}</span>
            </div>
          )) : <p className="empty-state">No voice corrections saved yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Browser Memory</p>
        <h2>Learned site aliases</h2>
        <div className="memory-list">
          {browserAliases.length > 0 ? browserAliases.map((alias) => (
            <div className="memory-card" key={alias.id}>
              <h3>{alias.phrase}</h3>
              <p>{alias.url}</p>
              <span className="memory-meta">Saved: {alias.createdAt}</span>
            </div>
          )) : <p className="empty-state">No browser aliases saved yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">External Notes</p>
        <h2>Recent Notion notes</h2>
        <div className="memory-list">
          {recentNotes.length > 0 ? recentNotes.map((note, index) => (
            <div className="memory-card" key={note.id}>
              <h3>{index + 1}. {note.title}</h3>
              <p>{note.summary}</p>
              <span className="memory-meta">Edited: {note.lastEditedTime}</span>
            </div>
          )) : <p className="empty-state">No Notion notes loaded yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        {buildPlannerCopilotCard({
          googleCalendarAccessToken,
          notionStatus,
          runCommand,
        })}
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Planner</p>
        <h2>Task notes</h2>
        <div className="memory-list">
          {plannerTasks.length > 0 ? plannerTasks.map((task, index) => (
            <div className="memory-card" key={task.id}>
              <h3>{index + 1}. {task.title}</h3>
              <p>Due: {task.dueLabel ?? "unscheduled"} | Status: {task.status}</p>
              <span className="memory-meta">Source: {task.sourceNote.title}</span>
            </div>
          )) : <p className="empty-state">No task notes loaded yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Inbox</p>
        <h2>Recent Gmail messages</h2>
        <div className="memory-list">
          {recentEmails.length > 0 ? recentEmails.map((email, index) => (
            <div className="memory-card" key={email.id}>
              <h3>{index + 1}. {email.subject}</h3>
              <p>{email.from}</p>
              <p>{email.snippet}</p>
              <span className="memory-meta">{email.date}</span>
            </div>
          )) : <p className="empty-state">No Gmail messages loaded yet.</p>}
        </div>
      </article>
      <article className="glass-panel">
        <p className="section-kicker">Local Files</p>
        <h2>Recent Documents files</h2>
        <div className="memory-list">
          {recentFiles.length > 0 ? recentFiles.map((file, index) => (
            <div className="memory-card" key={file.path}>
              <h3>{index + 1}. {file.name}</h3>
              <p>{file.path}</p>
              <span className="memory-meta">Modified: {file.modifiedAt}</span>
            </div>
          )) : <p className="empty-state">No recent local files loaded yet.</p>}
        </div>
      </article>
    </section>,
  ];
}

