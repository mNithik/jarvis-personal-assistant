import { ReactNode } from "react";
import type { MemorySectionProps } from "./sectionTypes";
import { buildEmailCopilotCard } from "./EmailSections";
import MemoryControlsPanel from "./MemoryControlsPanel";
import { TopicGraphPanel } from "./TopicGraphPanel";

function formatMeetingStart(start?: string | null) {
  if (!start) {
    return "Time TBD";
  }
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return start;
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function buildMemoryWorkspaceSections({
  displayExpenseMemory,
  displayMeetingPrepMemory,
  displayPackageMemory,
  displayPeopleMemory,
  displaySchoolPlanMemory,
  displayTravelMemory,
  lastKnowledgeRecall,
  memoryTotal,
  rustExpenseMemory,
  rustMeetingPrepMemory,
  rustPackageMemory,
  rustPeopleMemory,
  rustSchoolPlanMemory,
  rustTravelMemory,
  googleCalendarAccessToken,
  gmailAccessToken,
  nextMeetingEvent,
  meetingPrepStatus,
  runCommand,
}: MemorySectionProps): ReactNode[] {
  const prepCount = displayMeetingPrepMemory.length;
  const showMeetingCopilot = Boolean(googleCalendarAccessToken && nextMeetingEvent);

  return [
    <section className="grid-layout single-column" key="memory-main">
      {buildEmailCopilotCard({ gmailAccessToken, runCommand })}
      {showMeetingCopilot ? (
        <div className="result-card">
          <p className="section-kicker">Meeting Copilot</p>
          <h3>{nextMeetingEvent?.summary ?? "Upcoming meeting"}</h3>
          <p className="result-meta">
            Starts {formatMeetingStart(nextMeetingEvent?.start)} · {meetingPrepStatus ?? "Checking prep"}
          </p>
          <p className="result-meta">
            {prepCount === 0
              ? "Prep refreshes from calendar, Gmail, Notion tasks, and vault memory."
              : `${prepCount} saved prep item${prepCount === 1 ? "" : "s"} in memory.`}
          </p>
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runCommand?.("Prep me for my next meeting")}
            >
              Prep me
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runCommand?.("Refresh meeting prep")}
            >
              Refresh prep
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runCommand?.("Show meeting prep")}
            >
              Show prep
            </button>
          </div>
        </div>
      ) : null}
      {displayTravelMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Travel Copilot</p>
          <h3>{displayTravelMemory[0]?.title ?? "Upcoming trip"}</h3>
          <p className="result-meta">{displayTravelMemory[0]?.summary}</p>
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runCommand?.("prep me for my trip")}
            >
              Prep trip
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runCommand?.("refresh travel prep")}
            >
              Refresh prep
            </button>
          </div>
        </div>
      ) : null}
      <TopicGraphPanel key="topic-graph" />
      {lastKnowledgeRecall ? (
        <div className="result-card">
          <p className="section-kicker">Last Recalled Context</p>
          <h3>Gateway memory prefetch</h3>
          <p className="result-meta">
            {lastKnowledgeRecall.turnId ? `Turn ${lastKnowledgeRecall.turnId} - ` : ""}
            {lastKnowledgeRecall.createdAt}
          </p>
          <p>{lastKnowledgeRecall.message}</p>
        </div>
      ) : null}
      {displayPeopleMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">People Memory</p>
          <h3>
            {displayPeopleMemory.length} saved birthday{displayPeopleMemory.length === 1 ? "" : "s"}
          </h3>
          <p className="result-meta">
            Follow-ups: {displayPeopleMemory.filter((person) => person.followUpDueLabel).length} saved
            {rustPeopleMemory ? " · synced from jarvis.db" : ""}
          </p>
        </div>
      ) : null}
      {displayTravelMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Travel Memory</p>
          <h3>
            {displayTravelMemory.length} saved travel item{displayTravelMemory.length === 1 ? "" : "s"}
          </h3>
          <p className="result-meta">
            {displayTravelMemory
              .slice(0, 3)
              .map((item) => item.title)
              .join(", ")}
            {rustTravelMemory ? " · synced from jarvis.db" : ""}
          </p>
        </div>
      ) : null}
      {displayExpenseMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Expense Memory</p>
          <h3>
            {displayExpenseMemory.length} saved expense item{displayExpenseMemory.length === 1 ? "" : "s"}
          </h3>
          <p className="result-meta">
            Likely subscriptions: {displayExpenseMemory.filter((item) => item.recurringLikely).length}
            {rustExpenseMemory ? " · synced from jarvis.db" : ""}
          </p>
        </div>
      ) : null}
      {displayPackageMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Package Memory</p>
          <h3>
            {displayPackageMemory.length} saved package item{displayPackageMemory.length === 1 ? "" : "s"}
          </h3>
          <p className="result-meta">
            {displayPackageMemory
              .slice(0, 3)
              .map((item) => item.title)
              .join(", ")}
            {rustPackageMemory ? " · synced from jarvis.db" : ""}
          </p>
        </div>
      ) : null}
      {displayMeetingPrepMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">Meeting Prep Memory</p>
          <h3>
            {displayMeetingPrepMemory.length} saved prep item{displayMeetingPrepMemory.length === 1 ? "" : "s"}
          </h3>
          {rustMeetingPrepMemory ? <p className="result-meta">synced from jarvis.db</p> : null}
        </div>
      ) : null}
      {displaySchoolPlanMemory.length > 0 ? (
        <div className="result-card">
          <p className="section-kicker">School Memory</p>
          <h3>
            {displaySchoolPlanMemory.length} saved school plan{displaySchoolPlanMemory.length === 1 ? "" : "s"}
          </h3>
          {rustSchoolPlanMemory ? <p className="result-meta">synced from jarvis.db</p> : null}
        </div>
      ) : null}
      {displayPeopleMemory.length > 0 ? (
        <MemoryControlsPanel domain="people" title="People memory controls" />
      ) : null}
      {displayTravelMemory.length > 0 ? (
        <MemoryControlsPanel domain="travel" title="Travel memory controls" />
      ) : null}
      {memoryTotal === 0 && !showMeetingCopilot ? (
        <p className="empty-state">
          No memory captured yet. Save birthdays, travel, expenses, or school plans to grow this workspace.
        </p>
      ) : null}
    </section>,
  ];
}
