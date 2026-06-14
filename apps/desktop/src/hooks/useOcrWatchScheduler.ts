import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import type { OcrWatchTarget } from "../features/command/jarvisCommandTypes";

export function useOcrWatchScheduler(
  ocrWatchTargets: OcrWatchTarget[],
  runOcrWatchCheck: (watch: OcrWatchTarget) => void | Promise<void>,
) {
  useEffect(() => {
    const activeWatches = ocrWatchTargets.filter((target) => target.status === "active");
    if (activeWatches.length === 0) {
      return;
    }

    const runActiveOcrWatches = () => {
      activeWatches.forEach((watch) => {
        void runOcrWatchCheck(watch);
      });
    };

    const timers = activeWatches.map((watch) =>
      window.setInterval(() => {
        void runOcrWatchCheck(watch);
      }, watch.intervalMs),
    );

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen("ocr-watch-tick", () => {
      runActiveOcrWatches();
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }
      unlisten = nextUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
      timers.forEach((timer) => window.clearInterval(timer));
    };
  }, [ocrWatchTargets, runOcrWatchCheck]);
}
