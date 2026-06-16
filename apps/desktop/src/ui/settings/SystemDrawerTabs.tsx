import { ReactNode, useState } from "react";

type DrawerTab = "gateway" | "models" | "integrations" | "voice";

type SystemDrawerTabsProps = {
  gateway: ReactNode;
  models: ReactNode;
  integrations: ReactNode;
  voice: ReactNode;
};

const TAB_LABELS: Record<DrawerTab, string> = {
  gateway: "Gateway",
  models: "Models",
  integrations: "Integrations",
  voice: "Voice",
};

export default function SystemDrawerTabs({
  gateway,
  models,
  integrations,
  voice,
}: SystemDrawerTabsProps) {
  const [tab, setTab] = useState<DrawerTab>("gateway");
  const panels: Record<DrawerTab, ReactNode> = {
    gateway,
    models,
    integrations,
    voice,
  };

  return (
    <div className="system-drawer-tabs">
      <div className="system-drawer-tablist" role="tablist" aria-label="Settings sections">
        {(Object.keys(TAB_LABELS) as DrawerTab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`system-drawer-tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>
      <div className="system-drawer-tabpanel" role="tabpanel">
        {panels[tab]}
      </div>
    </div>
  );
}
