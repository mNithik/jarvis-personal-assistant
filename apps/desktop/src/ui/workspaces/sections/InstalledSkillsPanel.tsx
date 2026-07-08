import { useCallback, useEffect, useState } from "react";

import { ACTIVE_PROFILE_CHANGED_EVENT } from "../../../features/gateway/profileEvents";
import {
  installMarketplaceSkill,
  listInstalledSkills,
  listMarketplaceCatalog,
  marketplaceOperatorLane,
  refreshMarketplaceCatalog,
  type InstalledSkillRecord,
  type MarketplaceCatalogEntry,
} from "../../../services/jarvisApi";

export default function InstalledSkillsPanel() {
  const [skills, setSkills] = useState<InstalledSkillRecord[]>([]);
  const [catalog, setCatalog] = useState<MarketplaceCatalogEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSkills(await listInstalledSkills());
      setCatalog(await listMarketplaceCatalog());
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
        <ul className="memory-list" data-testid="installed-skills-list">
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
      <p className="section-kicker">Marketplace (T17-F)</p>
      <div className="inline-actions">
        <button
          type="button"
          className="ghost-button"
          data-testid="marketplace-refresh-catalog"
          onClick={() => {
            void (async () => {
              try {
                setCatalog(await refreshMarketplaceCatalog());
                setStatus("Refreshed remote marketplace catalog.");
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            })();
          }}
        >
          Refresh remote catalog
        </button>
      </div>
      {catalog.length === 0 ? (
        <p className="result-meta">No marketplace catalog entries are bundled yet.</p>
      ) : (
        <ul className="memory-list" data-testid="marketplace-catalog">
          {catalog.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong> v{entry.version} — {entry.description}
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button"
                  data-testid={`marketplace-install-${entry.id}`}
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await installMarketplaceSkill(entry.id);
                        const lane = await marketplaceOperatorLane(entry.id);
                        await refresh();
                        setStatus(`${result.message} ${lane}`);
                      } catch (error) {
                        setStatus(error instanceof Error ? error.message : String(error));
                      }
                    })();
                  }}
                >
                  Install
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}
