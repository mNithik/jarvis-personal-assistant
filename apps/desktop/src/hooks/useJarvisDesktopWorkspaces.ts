import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  DESKTOP_PROJECTS_STORAGE_KEY,
  DESKTOP_SCHEDULES_STORAGE_KEY,
} from "../features/command/parsers/explicitIntent";
import { normalizeDesktopProjectName } from "../features/command/parsers/desktopIntent";
import type {
  CommandIntent,
  DesktopProjectRecord,
  DesktopScheduleRecord,
} from "../features/command/jarvisCommandTypes";
import { listDesktopSchedulesDb, saveDesktopSchedule } from "../services/jarvisApi";

type UseJarvisDesktopWorkspacesOptions = {
  gatewayEnabled?: boolean;
  setStatusMessage: (message: string) => void;
};

/** Wave 2 peel: desktop workspace CRUD, persistence, and schedule timers. */
export function useJarvisDesktopWorkspaces({
  gatewayEnabled = false,
  setStatusMessage,
}: UseJarvisDesktopWorkspacesOptions) {
  const [desktopProjects, setDesktopProjects] = useState<DesktopProjectRecord[]>([]);
  const [desktopSchedules, setDesktopSchedules] = useState<DesktopScheduleRecord[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESKTOP_PROJECTS_STORAGE_KEY);
      if (saved) {
        setDesktopProjects(JSON.parse(saved) as DesktopProjectRecord[]);
      }
    } catch {
      setDesktopProjects([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_PROJECTS_STORAGE_KEY,
        JSON.stringify(desktopProjects),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop projects locally.");
    }
  }, [desktopProjects, setStatusMessage]);

  useEffect(() => {
    if (gatewayEnabled) {
      void listDesktopSchedulesDb()
        .then((schedules) => {
          if (schedules.length > 0) {
            setDesktopSchedules(
              schedules.map((schedule) => ({
                id: schedule.id,
                projectName: schedule.projectName,
                actionLabel: schedule.actionLabel,
                dueAt: schedule.dueAt,
                createdAt: schedule.createdAt,
              })),
            );
          }
        })
        .catch(() => {
          setStatusMessage("JARVIS could not load desktop schedules from SQLite.");
        });
      return;
    }

    try {
      const saved = window.localStorage.getItem(DESKTOP_SCHEDULES_STORAGE_KEY);
      if (saved) {
        setDesktopSchedules(JSON.parse(saved) as DesktopScheduleRecord[]);
      }
    } catch {
      setDesktopSchedules([]);
    }
  }, [gatewayEnabled, setStatusMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DESKTOP_SCHEDULES_STORAGE_KEY,
        JSON.stringify(desktopSchedules),
      );
    } catch {
      setStatusMessage("JARVIS could not persist desktop schedules locally.");
    }
    if (!gatewayEnabled) {
      return;
    }
    void Promise.all(
      desktopSchedules.map((schedule) =>
        saveDesktopSchedule({
          id: schedule.id,
          projectName: schedule.projectName,
          actionLabel: schedule.actionLabel,
          dueAt: schedule.dueAt,
          createdAt: schedule.createdAt,
        }),
      ),
    ).catch(() => {
      setStatusMessage("JARVIS could not persist desktop schedules to SQLite.");
    });
  }, [desktopSchedules, gatewayEnabled, setStatusMessage]);

  const findDesktopProject = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim().toLowerCase();
      return (
        desktopProjects.find((project) => project.name.trim().toLowerCase() === normalizedQuery) ??
        desktopProjects.find((project) => project.name.toLowerCase().includes(normalizedQuery)) ??
        null
      );
    },
    [desktopProjects],
  );

  const createDesktopProject = useCallback(
    (name: string): DesktopProjectRecord | null => {
      const normalizedName = normalizeDesktopProjectName(name);
      if (!normalizedName) {
        return null;
      }

      const nowIso = new Date().toISOString();
      const existing = desktopProjects.find(
        (project) => project.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );
      if (existing) {
        return existing;
      }

      const savedProject: DesktopProjectRecord = {
        id: `${Date.now()}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: normalizedName,
        apps: [],
        folders: [],
        websites: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setDesktopProjects((current) => [savedProject, ...current]);

      return savedProject;
    },
    [desktopProjects],
  );

  const createDesktopProjectFromTemplate = useCallback(
    (templateName: string, projectName: string): DesktopProjectRecord | null => {
      const normalizedTemplate = templateName.trim().toLowerCase();
      const normalizedName = normalizeDesktopProjectName(projectName);
      if (!normalizedName) {
        return null;
      }

      const template = (() => {
        switch (normalizedTemplate) {
          case "coding":
          case "code":
            return {
              apps: ["vs code", "powershell"],
              folders: ["jarvis project"],
              websites: ["https://github.com"],
            };
          case "school":
          case "study":
            return {
              apps: ["vs code"],
              folders: ["documents", "downloads"],
              websites: [
                "https://calendar.google.com",
                "https://docs.google.com",
                "https://drive.google.com",
                "https://www.notion.so",
              ],
            };
          case "focus":
            return {
              apps: ["vs code", "notepad"],
              folders: ["documents"],
              websites: ["https://calendar.google.com", "https://www.notion.so"],
            };
          case "music":
            return {
              apps: ["spotify"],
              folders: [],
              websites: ["https://open.spotify.com"],
            };
          default:
            return null;
        }
      })();

      if (!template) {
        return null;
      }

      const nowIso = new Date().toISOString();
      const existing = desktopProjects.find(
        (project) => project.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );
      const savedProject: DesktopProjectRecord = {
        id: existing?.id ?? `${Date.now()}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: normalizedName,
        apps: Array.from(new Set([...(existing?.apps ?? []), ...template.apps])),
        folders: Array.from(new Set([...(existing?.folders ?? []), ...template.folders])),
        websites: Array.from(new Set([...(existing?.websites ?? []), ...template.websites])),
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };

      setDesktopProjects((current) =>
        existing
          ? current.map((project) => (project.id === existing.id ? savedProject : project))
          : [savedProject, ...current],
      );

      return savedProject;
    },
    [desktopProjects],
  );

  const updateDesktopProject = useCallback(
    (
      query: string,
      updater: (project: DesktopProjectRecord) => DesktopProjectRecord,
    ): DesktopProjectRecord | null => {
      const existingProject = findDesktopProject(query);
      if (!existingProject) {
        return null;
      }

      const updatedProject = updater(existingProject);
      setDesktopProjects((current) =>
        current.map((project) => (project.id === existingProject.id ? updatedProject : project)),
      );

      return updatedProject;
    },
    [findDesktopProject],
  );

  const deleteDesktopProject = useCallback(
    (query: string): DesktopProjectRecord | null => {
      const existingProject = findDesktopProject(query);
      if (!existingProject) {
        return null;
      }

      setDesktopProjects((current) =>
        current.filter((project) => project.id !== existingProject.id),
      );
      return existingProject;
    },
    [findDesktopProject],
  );

  return {
    desktopProjects,
    setDesktopProjects: setDesktopProjects as Dispatch<SetStateAction<DesktopProjectRecord[]>>,
    desktopSchedules,
    setDesktopSchedules: setDesktopSchedules as Dispatch<SetStateAction<DesktopScheduleRecord[]>>,
    findDesktopProject,
    createDesktopProject,
    createDesktopProjectFromTemplate,
    updateDesktopProject,
    deleteDesktopProject,
  };
}

type UseJarvisDesktopScheduleTimersOptions = {
  desktopSchedules: DesktopScheduleRecord[];
  executeIntent: (intent: CommandIntent) => Promise<boolean | undefined>;
  setDesktopSchedules: Dispatch<SetStateAction<DesktopScheduleRecord[]>>;
};

/** Fires due workspace schedules once executeIntent is wired. */
export function useJarvisDesktopScheduleTimers({
  desktopSchedules,
  executeIntent,
  setDesktopSchedules,
}: UseJarvisDesktopScheduleTimersOptions) {
  useEffect(() => {
    const timers = desktopSchedules
      .map((schedule) => {
        const delay = new Date(schedule.dueAt).getTime() - Date.now();
        if (delay <= 0) {
          void executeIntent({ kind: "open_desktop_project", query: schedule.projectName });
          setDesktopSchedules((current) => current.filter((item) => item.id !== schedule.id));
          return null;
        }

        if (delay > 24 * 60 * 60 * 1000) {
          return null;
        }

        return window.setTimeout(() => {
          void executeIntent({ kind: "open_desktop_project", query: schedule.projectName });
          setDesktopSchedules((current) => current.filter((item) => item.id !== schedule.id));
        }, delay);
      })
      .filter(Boolean) as number[];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [desktopSchedules, executeIntent, setDesktopSchedules]);
}
