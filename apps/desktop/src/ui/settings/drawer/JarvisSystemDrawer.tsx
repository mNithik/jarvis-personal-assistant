import { type ReactNode } from "react";

import SystemDrawerStack from "../SystemDrawerStack";
import DrawerIntegrationsPanel from "./DrawerIntegrationsPanel";
import DrawerModelsPanel from "./DrawerModelsPanel";
import DrawerVoicePanel from "./DrawerVoicePanel";
import { JarvisSystemDrawerProvider, type JarvisSystemDrawerContextValue } from "./JarvisSystemDrawerContext";

type JarvisSystemDrawerProps = {
  drawerContext: JarvisSystemDrawerContextValue;
  children?: ReactNode;
};

/** Tabbed system drawer: Gateway | Models | Integrations | Voice */
export default function JarvisSystemDrawer({ drawerContext }: JarvisSystemDrawerProps) {
  return (
    <JarvisSystemDrawerProvider value={drawerContext}>
      <SystemDrawerStack
        modelsPanel={<DrawerModelsPanel />}
        integrationsPanel={<DrawerIntegrationsPanel />}
        voicePanel={<DrawerVoicePanel />}
      />
    </JarvisSystemDrawerProvider>
  );
}
