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

export function buildSlackCopilotCard({ runCommand }: Pick<EmailSectionProps, "runCommand">) {
  return (
    <div className="result-card" key="slack-copilot">
      <p className="section-kicker">Slack Copilot</p>
      <h3>Summaries, drafts, and approvals</h3>
      <p className="result-meta">
        Read channels and threads automatically. Sends are approval-gated in Mission Control.
      </p>
      <p className="result-meta">
        Setup: add `JARVIS_SLACK_BOT_TOKEN` (with conversations:history, conversations:replies,
        chat:write).
      </p>
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("summarize slack channel #general")}
        >
          Summarize #general
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("summarize slack thread #general:1711111111.000100")}
        >
          Summarize thread
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("draft a slack update for #general about roadmap")}
        >
          Draft update
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void runCommand?.("send this to slack #general")}
        >
          Send drafted
        </button>
      </div>
    </div>
  );
}
