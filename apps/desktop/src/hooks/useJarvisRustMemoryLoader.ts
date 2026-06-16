import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type {
  ExpenseMemoryRecord,
  MeetingPrepMemoryRecord,
  PackageMemoryRecord,
  PersonMemoryRecord,
  SchoolPlanMemoryRecord,
  TravelMemoryRecord,
} from "../features/command/jarvisCommandTypes";
import {
  importExpenseMemory,
  importMeetingPrepMemory,
  importPackageMemory,
  importPeopleMemory,
  importSchoolPlanMemory,
  importTravelMemory,
  memoryListExpenses,
  memoryListMeetingPrep,
  memoryListPackages,
  memoryListPeople,
  memoryListSchoolPlans,
  memoryListTravel,
} from "../services/jarvisApi";
import {
  EXPENSE_MEMORY_STORAGE_KEY,
  MEETING_PREP_MEMORY_STORAGE_KEY,
  PACKAGE_MEMORY_STORAGE_KEY,
  PEOPLE_MEMORY_STORAGE_KEY,
  SCHOOL_PLAN_MEMORY_STORAGE_KEY,
  TRAVEL_MEMORY_STORAGE_KEY,
} from "../features/legacy/appHelpers";

export type JarvisRustMemoryState = {
  rustPeopleMemory: PersonMemoryRecord[] | null;
  rustTravelMemory: TravelMemoryRecord[] | null;
  rustExpenseMemory: ExpenseMemoryRecord[] | null;
  rustPackageMemory: PackageMemoryRecord[] | null;
  rustMeetingPrepMemory: MeetingPrepMemoryRecord[] | null;
  rustSchoolPlanMemory: SchoolPlanMemoryRecord[] | null;
  setRustPeopleMemory: Dispatch<SetStateAction<PersonMemoryRecord[] | null>>;
  setRustTravelMemory: Dispatch<SetStateAction<TravelMemoryRecord[] | null>>;
  setRustExpenseMemory: Dispatch<SetStateAction<ExpenseMemoryRecord[] | null>>;
  setRustPackageMemory: Dispatch<SetStateAction<PackageMemoryRecord[] | null>>;
  setRustMeetingPrepMemory: Dispatch<SetStateAction<MeetingPrepMemoryRecord[] | null>>;
  setRustSchoolPlanMemory: Dispatch<SetStateAction<SchoolPlanMemoryRecord[] | null>>;
};

/** Wave 10 S30: sync Rust memory tables when gateway memory feature is enabled. */
export function useJarvisRustMemoryLoader(
  memoryEnabled: boolean | undefined,
): JarvisRustMemoryState {
  const [rustPeopleMemory, setRustPeopleMemory] = useState<PersonMemoryRecord[] | null>(null);
  const [rustTravelMemory, setRustTravelMemory] = useState<TravelMemoryRecord[] | null>(null);
  const [rustExpenseMemory, setRustExpenseMemory] = useState<ExpenseMemoryRecord[] | null>(null);
  const [rustPackageMemory, setRustPackageMemory] = useState<PackageMemoryRecord[] | null>(null);
  const [rustMeetingPrepMemory, setRustMeetingPrepMemory] =
    useState<MeetingPrepMemoryRecord[] | null>(null);
  const [rustSchoolPlanMemory, setRustSchoolPlanMemory] =
    useState<SchoolPlanMemoryRecord[] | null>(null);

  useEffect(() => {
    if (!memoryEnabled) {
      setRustPeopleMemory(null);
      setRustTravelMemory(null);
      setRustExpenseMemory(null);
      setRustPackageMemory(null);
      setRustMeetingPrepMemory(null);
      setRustSchoolPlanMemory(null);
      return;
    }

    void (async () => {
      try {
        let people = await memoryListPeople();
        if (people.length === 0) {
          const saved = window.localStorage.getItem(PEOPLE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localPeople = JSON.parse(saved) as PersonMemoryRecord[];
            if (localPeople.length > 0) {
              await importPeopleMemory(localPeople);
              people = await memoryListPeople();
            }
          }
        }
        setRustPeopleMemory(people);

        let travel = await memoryListTravel();
        if (travel.length === 0) {
          const saved = window.localStorage.getItem(TRAVEL_MEMORY_STORAGE_KEY);
          if (saved) {
            const localTravel = JSON.parse(saved) as TravelMemoryRecord[];
            if (localTravel.length > 0) {
              await importTravelMemory(localTravel);
              travel = await memoryListTravel();
            }
          }
        }
        setRustTravelMemory(travel);

        let expenses = await memoryListExpenses();
        if (expenses.length === 0) {
          const saved = window.localStorage.getItem(EXPENSE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localExpenses = JSON.parse(saved) as ExpenseMemoryRecord[];
            if (localExpenses.length > 0) {
              await importExpenseMemory(localExpenses);
              expenses = await memoryListExpenses();
            }
          }
        }
        setRustExpenseMemory(expenses);

        let packages = await memoryListPackages();
        if (packages.length === 0) {
          const saved = window.localStorage.getItem(PACKAGE_MEMORY_STORAGE_KEY);
          if (saved) {
            const localPackages = JSON.parse(saved) as PackageMemoryRecord[];
            if (localPackages.length > 0) {
              await importPackageMemory(localPackages);
              packages = await memoryListPackages();
            }
          }
        }
        setRustPackageMemory(packages);

        let meetingPrep = await memoryListMeetingPrep();
        if (meetingPrep.length === 0) {
          const saved = window.localStorage.getItem(MEETING_PREP_MEMORY_STORAGE_KEY);
          if (saved) {
            const localMeetingPrep = JSON.parse(saved) as MeetingPrepMemoryRecord[];
            if (localMeetingPrep.length > 0) {
              await importMeetingPrepMemory(localMeetingPrep);
              meetingPrep = await memoryListMeetingPrep();
            }
          }
        }
        setRustMeetingPrepMemory(meetingPrep);

        let schoolPlans = await memoryListSchoolPlans();
        if (schoolPlans.length === 0) {
          const saved = window.localStorage.getItem(SCHOOL_PLAN_MEMORY_STORAGE_KEY);
          if (saved) {
            const localSchoolPlans = JSON.parse(saved) as SchoolPlanMemoryRecord[];
            if (localSchoolPlans.length > 0) {
              await importSchoolPlanMemory(localSchoolPlans);
              schoolPlans = await memoryListSchoolPlans();
            }
          }
        }
        setRustSchoolPlanMemory(schoolPlans);
      } catch {
        setRustPeopleMemory(null);
        setRustTravelMemory(null);
        setRustExpenseMemory(null);
        setRustPackageMemory(null);
        setRustMeetingPrepMemory(null);
        setRustSchoolPlanMemory(null);
      }
    })();
  }, [memoryEnabled]);

  return {
    rustPeopleMemory,
    rustTravelMemory,
    rustExpenseMemory,
    rustPackageMemory,
    rustMeetingPrepMemory,
    rustSchoolPlanMemory,
    setRustPeopleMemory,
    setRustTravelMemory,
    setRustExpenseMemory,
    setRustPackageMemory,
    setRustMeetingPrepMemory,
    setRustSchoolPlanMemory,
  };
}
