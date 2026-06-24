import { useCallback, useEffect, useState } from "react";

import { ACTIVE_PROFILE_CHANGED_EVENT } from "../../../features/gateway/profileEvents";
import { listInstalledSkills, type InstalledSkillRecord } from "../../../services/jarvisApi";

export default function InstalledSkillsPanel() {
  const [skills, setSkills] = useState<InstalledSkillRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSkills(await listInstalledSkills());
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleProfileChanged() {
      void refresh();
    }
    window.addEventListener(ACTIVE_PROFILE_CHANGED_EVENT, handleProfileChanged);
    return () => {
      window.removeEventListener(ACTIVE_PROFILE_CHANGED_EVENT, handleProfileChanged);
    };
  }, [refresh]);

  return (
    <div className="result-card" data-testid="installed-skills-panel">
      <p className="section-kicker">Skill SDK</p>
      <h3>Installed skills</h3>
      {skills.length === 0 ? (
        <p className="result-meta">
          No global or active-profile skills found in <code>app_data/skills</code>.
        </p>
      ) : (
        <ul className="memory-list">
          {skills.map((skill) => (
            <li key={skill.id}>
              <strong>{skill.label}</strong> v{skill.version} - {skill.keywords.join(", ")}{" "}
              <span className="result-meta">
                [
                {skill.sourceScope === "profile"
                  ? `profile:${skill.profileId ?? "active"}`
                  : "global"}
                ]
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="result-meta">
        Profile-local skills in <code>app_data/skills/{"{profileId}"}</code> override global
        skills with the same id.
      </p>
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}
