import { ReactNode } from "react";

import GatewayConfigPanel from "./GatewayConfigPanel";

type SystemDrawerStackProps = {
  advancedPanel: ReactNode;
};

export default function SystemDrawerStack({ advancedPanel }: SystemDrawerStackProps) {
  return (
    <>
      <GatewayConfigPanel />
      {advancedPanel}
    </>
  );
}
