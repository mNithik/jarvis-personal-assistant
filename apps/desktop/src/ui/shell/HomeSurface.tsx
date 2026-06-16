import { ReactNode } from "react";

type HomeSurfaceProps = {
  hero: ReactNode;
  dataSphere: ReactNode;
  shellSummary: ReactNode;
  appLaunchpad: ReactNode;
};

export default function HomeSurface({
  hero,
  dataSphere,
  shellSummary,
  appLaunchpad,
}: HomeSurfaceProps) {
  return (
    <>
      {hero}
      {appLaunchpad}
      {dataSphere}
      {shellSummary}
    </>
  );
}
