import { ReactNode } from "react";
import type { MemorySectionProps } from "./sectionTypes";

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
}: MemorySectionProps): ReactNode[] {
  return [
    <section className="grid-layout single-column" key="memory-main">
      {lastKnowledgeRecall ? <div className="result-card"><p className="section-kicker">Last Recalled Context</p><h3>Gateway memory prefetch</h3><p className="result-meta">{lastKnowledgeRecall.turnId ? `Turn ${lastKnowledgeRecall.turnId} - ` : ""}{lastKnowledgeRecall.createdAt}</p><p>{lastKnowledgeRecall.message}</p></div> : null}
      {displayPeopleMemory.length > 0 ? <div className="result-card"><p className="section-kicker">People Memory</p><h3>{displayPeopleMemory.length} saved birthday{displayPeopleMemory.length === 1 ? "" : "s"}</h3><p className="result-meta">Follow-ups: {displayPeopleMemory.filter((person) => person.followUpDueLabel).length} saved{rustPeopleMemory ? " · synced from jarvis.db" : ""}</p></div> : null}
      {displayTravelMemory.length > 0 ? <div className="result-card"><p className="section-kicker">Travel Memory</p><h3>{displayTravelMemory.length} saved travel item{displayTravelMemory.length === 1 ? "" : "s"}</h3><p className="result-meta">{displayTravelMemory.slice(0, 3).map((item) => item.title).join(", ")}{rustTravelMemory ? " · synced from jarvis.db" : ""}</p></div> : null}
      {displayExpenseMemory.length > 0 ? <div className="result-card"><p className="section-kicker">Expense Memory</p><h3>{displayExpenseMemory.length} saved expense item{displayExpenseMemory.length === 1 ? "" : "s"}</h3><p className="result-meta">Likely subscriptions: {displayExpenseMemory.filter((item) => item.recurringLikely).length}{rustExpenseMemory ? " · synced from jarvis.db" : ""}</p></div> : null}
      {displayPackageMemory.length > 0 ? <div className="result-card"><p className="section-kicker">Package Memory</p><h3>{displayPackageMemory.length} saved package item{displayPackageMemory.length === 1 ? "" : "s"}</h3><p className="result-meta">{displayPackageMemory.slice(0, 3).map((item) => item.title).join(", ")}{rustPackageMemory ? " · synced from jarvis.db" : ""}</p></div> : null}
      {displayMeetingPrepMemory.length > 0 ? <div className="result-card"><p className="section-kicker">Meeting Prep Memory</p><h3>{displayMeetingPrepMemory.length} saved prep item{displayMeetingPrepMemory.length === 1 ? "" : "s"}</h3>{rustMeetingPrepMemory ? <p className="result-meta">synced from jarvis.db</p> : null}</div> : null}
      {displaySchoolPlanMemory.length > 0 ? <div className="result-card"><p className="section-kicker">School Memory</p><h3>{displaySchoolPlanMemory.length} saved school plan{displaySchoolPlanMemory.length === 1 ? "" : "s"}</h3>{rustSchoolPlanMemory ? <p className="result-meta">synced from jarvis.db</p> : null}</div> : null}
      {memoryTotal === 0 ? <p className="empty-state">No memory captured yet. Save birthdays, travel, expenses, or school plans to grow this workspace.</p> : null}
    </section>,
  ];
}
