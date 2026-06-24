import { useCallback, useEffect, useState } from "react";

import { ACTIVE_PROFILE_CHANGED_EVENT } from "../../features/gateway/profileEvents";
import {
  getActiveProfile,
  listUserProfiles,
  switchUserProfile,
  type UserProfileRecord,
} from "../../services/jarvisApi";

export default function ProfileSwitcherPanel() {
  const [profiles, setProfiles] = useState<UserProfileRecord[]>([]);
  const [active, setActive] = useState<UserProfileRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [rows, current] = await Promise.all([listUserProfiles(), getActiveProfile()]);
      setProfiles(rows);
      setActive(current);
      window.dispatchEvent(
        new CustomEvent(ACTIVE_PROFILE_CHANGED_EVENT, {
          detail: current,
        }),
      );
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSwitch(profileId: string) {
    try {
      const message = await switchUserProfile(profileId);
      setStatus(message);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="result-card" data-testid="profile-switcher-panel">
      <p className="section-kicker">Profiles</p>
      <h3>Work / personal / lab</h3>
      <p className="result-meta" data-testid="profile-active-label">
        Active: {active?.name ?? "Default gateway.json"}
      </p>
      <div className="inline-actions">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className="secondary-button"
            data-testid={`profile-switch-${profile.id}`}
            onClick={() => void handleSwitch(profile.id)}
          >
            {profile.name}
          </button>
        ))}
      </div>
      {status ? <p className="result-meta">{status}</p> : null}
    </div>
  );
}
