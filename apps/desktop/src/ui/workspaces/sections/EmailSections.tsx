import type { EmailSectionProps } from "./sectionTypes";

export function buildEmailCopilotCard({
  gmailAccessToken,
  runCommand,
}: EmailSectionProps) {
  if (!gmailAccessToken) {
    return (
      <div className="result-card" key="email-copilot">
        <p className="section-kicker">Email Copilot</p>
        <h3>Connect Gmail to enable triage + drafts</h3>
        <p className="result-meta">
          Open Settings → Integrations and connect Gmail. Then this panel enables one-click triage,
          drafting, and Notion capture.
        </p>
      </div>
    );
  }

  return (
    <div className="result-card" key="email-copilot">
      <p className="section-kicker">Email Copilot</p>
      <h3>Inbox triage + drafts</h3>
      <p className="result-meta">
        Rank unread mail, draft replies, and save threads to Notion from one card.
      </p>
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("triage my inbox")}
        >
          Triage inbox
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("draft a reply to email 1")}
        >
          Draft reply
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("save this email to notion")}
        >
          Save to Notion
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("read my email")}
        >
          Read unread
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("search email for follow up")}
        >
          Search follow-up
        </button>
      </div>
    </div>
  );
}
