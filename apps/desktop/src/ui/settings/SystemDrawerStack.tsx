import { ReactNode } from "react";

import GatewayConfigPanel from "./GatewayConfigPanel";
import SystemDrawerTabs from "./SystemDrawerTabs";

type SystemDrawerStackProps = {
  /** Legacy single scroll panel — used when tab panels are not provided */
  advancedPanel?: ReactNode;
  modelsPanel?: ReactNode;
  integrationsPanel?: ReactNode;
  voicePanel?: ReactNode;
};

export default function SystemDrawerStack({
  advancedPanel,
  modelsPanel,
  integrationsPanel,
  voicePanel,
}: SystemDrawerStackProps) {
  if (modelsPanel && integrationsPanel && voicePanel) {
    return (
      <SystemDrawerTabs
        gateway={<GatewayConfigPanel />}
        models={modelsPanel}
        integrations={integrationsPanel}
        voice={voicePanel}
      />
    );
  }

  return (
    <>
      <GatewayConfigPanel />
      {advancedPanel}
    </>
  );
}
