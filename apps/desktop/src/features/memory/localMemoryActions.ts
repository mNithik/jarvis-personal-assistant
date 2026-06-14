import type { Dispatch, SetStateAction } from "react";

import type { GatewayConfig } from "../../services/jarvisApi";
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
} from "../../services/jarvisApi";
import type {
  ExpenseMemoryRecord,
  MeetingPrepMemoryRecord,
  PackageMemoryRecord,
  PersonBirthdaySaveInput,
  PersonMemoryRecord,
  SchoolPlanMemoryRecord,
  TravelExtraction,
  TravelMemoryRecord,
} from "../legacy/appHelpers";
import {
  buildTravelChecklist,
  buildTravelTimeline,
  estimateTravelSegmentCount,
  findPersonByQuery,
  getPrimaryTravelSummary,
  isTodayDeliveryLabel,
  isTomorrowDeliveryLabel,
} from "../legacy/appHelpers";

export type LocalMemoryActionsDeps = {
  gatewayConfig: GatewayConfig | null;
  peopleMemory: PersonMemoryRecord[];
  setPeopleMemory: Dispatch<SetStateAction<PersonMemoryRecord[]>>;
  setTravelMemory: Dispatch<SetStateAction<TravelMemoryRecord[]>>;
  setExpenseMemory: Dispatch<SetStateAction<ExpenseMemoryRecord[]>>;
  setPackageMemory: Dispatch<SetStateAction<PackageMemoryRecord[]>>;
  setMeetingPrepMemory: Dispatch<SetStateAction<MeetingPrepMemoryRecord[]>>;
  setSchoolPlanMemory: Dispatch<SetStateAction<SchoolPlanMemoryRecord[]>>;
  setRustPeopleMemory: Dispatch<SetStateAction<PersonMemoryRecord[] | null>>;
  setRustTravelMemory: Dispatch<SetStateAction<TravelMemoryRecord[] | null>>;
  setRustExpenseMemory: Dispatch<SetStateAction<ExpenseMemoryRecord[] | null>>;
  setRustPackageMemory: Dispatch<SetStateAction<PackageMemoryRecord[] | null>>;
  setRustMeetingPrepMemory: Dispatch<SetStateAction<MeetingPrepMemoryRecord[] | null>>;
  setRustSchoolPlanMemory: Dispatch<SetStateAction<SchoolPlanMemoryRecord[] | null>>;
};

export function createLocalMemoryActions(deps: LocalMemoryActionsDeps) {
  function rememberPersonBirthday(candidate: PersonBirthdaySaveInput): PersonMemoryRecord | null {
    const nowIso = new Date().toISOString();
    let savedRecord: PersonMemoryRecord | null = null;

    deps.setPeopleMemory((current) => {
      const existing = current.find(
        (entry) => entry.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
      );

      if (existing) {
        savedRecord = {
          ...existing,
          birthdayLabel: candidate.birthdayLabel,
          month: candidate.month,
          day: candidate.day,
          age: candidate.age ?? existing.age,
          relationship: candidate.relationship ?? existing.relationship,
          giftNotes: candidate.giftNotes ?? existing.giftNotes,
          contactNotes: candidate.contactNotes ?? existing.contactNotes,
          lastContactLabel: candidate.lastContactLabel ?? existing.lastContactLabel,
          followUpDueLabel: candidate.followUpDueLabel ?? existing.followUpDueLabel,
          followUpReason: candidate.followUpReason ?? existing.followUpReason,
          reminderLeadDays: candidate.reminderLeadDays ?? existing.reminderLeadDays,
          calendarLinkedAt: candidate.calendarLinkedAt ?? existing.calendarLinkedAt,
          source: candidate.source,
          updatedAt: nowIso,
        };
        return [savedRecord, ...current.filter((entry) => entry.id !== existing.id)];
      }

      savedRecord = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: candidate.name.trim(),
        birthdayLabel: candidate.birthdayLabel,
        month: candidate.month,
        day: candidate.day,
        age: candidate.age ?? null,
        relationship: candidate.relationship ?? null,
        giftNotes: candidate.giftNotes ?? [],
        contactNotes: candidate.contactNotes ?? [],
        lastContactLabel: candidate.lastContactLabel ?? null,
        followUpDueLabel: candidate.followUpDueLabel ?? null,
        followUpReason: candidate.followUpReason ?? null,
        reminderLeadDays: candidate.reminderLeadDays ?? 7,
        calendarLinkedAt: candidate.calendarLinkedAt ?? null,
        source: candidate.source,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      return [savedRecord, ...current];
    });

    if (deps.gatewayConfig?.features.memory && savedRecord) {
      void importPeopleMemory([savedRecord])
        .then(() => memoryListPeople())
        .then((people) => deps.setRustPeopleMemory(people))
        .catch(() => undefined);
    }

    return savedRecord;
  }

  function updatePersonMemory(
    query: string,
    updater: (person: PersonMemoryRecord) => PersonMemoryRecord,
  ) {
    const existing = findPersonByQuery(deps.peopleMemory, query);
    if (!existing) {
      return null;
    }

    const updated = {
      ...updater(existing),
      updatedAt: new Date().toISOString(),
    };

    deps.setPeopleMemory((current) => [updated, ...current.filter((entry) => entry.id !== existing.id)]);
    return updated;
  }

  function rememberTravelSummary(
    title: string,
    sourceEmailSubject: string,
    details: TravelExtraction,
    summary: string,
    calendarLinkedAt: string | null = null,
  ) {
    const primary = getPrimaryTravelSummary(details);
    const record: TravelMemoryRecord = {
      id: `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      sourceEmailSubject,
      transport: primary.transport,
      departure: primary.departure,
      arrival: primary.arrival,
      hotel: primary.hotel,
      checkIn: primary.checkIn,
      checkOut: primary.checkOut,
      confirmationCode: primary.confirmationCode,
      calendarLinkedAt,
      segmentCount: estimateTravelSegmentCount(details),
      timeline: buildTravelTimeline(details),
      checklist: buildTravelChecklist(details),
      summary,
      createdAt: new Date().toISOString(),
    };

    deps.setTravelMemory((current) => [record, ...current].slice(0, 12));
    if (deps.gatewayConfig?.features.memory) {
      void importTravelMemory([record])
        .then(() => memoryListTravel())
        .then((items) => deps.setRustTravelMemory(items))
        .catch(() => undefined);
    }
    return record;
  }

  function rememberExpenseSummary(
    title: string,
    sourceEmailSubject: string,
    merchant: string | null,
    amount: string | null,
    amountValue: number | null,
    category: string | null,
    expenseDate: string | null,
    orderNumber: string | null,
    recurringLikely: boolean,
    summary: string,
  ) {
    const record: ExpenseMemoryRecord = {
      id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      sourceEmailSubject,
      merchant,
      amount,
      amountValue,
      category,
      expenseDate,
      orderNumber,
      recurringLikely,
      summary,
      createdAt: new Date().toISOString(),
    };

    deps.setExpenseMemory((current) => [record, ...current].slice(0, 20));
    if (deps.gatewayConfig?.features.memory) {
      void importExpenseMemory([record])
        .then(() => memoryListExpenses())
        .then((items) => deps.setRustExpenseMemory(items))
        .catch(() => undefined);
    }
    return record;
  }

  function rememberPackageSummary(
    title: string,
    sourceEmailSubject: string,
    carrier: string | null,
    merchant: string | null,
    itemLabel: string | null,
    status: string | null,
    deliveryDate: string | null,
    trackingNumber: string | null,
    summary: string,
  ) {
    const nowIso = new Date().toISOString();
    let savedRecord: PackageMemoryRecord | null = null;

    deps.setPackageMemory((current) => {
      const existing =
        current.find((entry) => trackingNumber && entry.trackingNumber === trackingNumber) ??
        current.find((entry) => entry.sourceEmailSubject.toLowerCase() === sourceEmailSubject.toLowerCase());

      if (existing) {
        savedRecord = {
          ...existing,
          title,
          sourceEmailSubject,
          carrier: carrier ?? existing.carrier,
          merchant: merchant ?? existing.merchant,
          itemLabel: itemLabel ?? existing.itemLabel,
          status: status ?? existing.status,
          deliveryDate: deliveryDate ?? existing.deliveryDate,
          trackingNumber: trackingNumber ?? existing.trackingNumber,
          statusHistory: Array.from(
            new Set(
              [status, ...existing.statusHistory, existing.status]
                .filter(Boolean)
                .map((value) => value as string),
            ),
          ),
          arrivingToday: isTodayDeliveryLabel(deliveryDate ?? existing.deliveryDate),
          arrivingTomorrow: isTomorrowDeliveryLabel(deliveryDate ?? existing.deliveryDate),
          summary,
          updatedAt: nowIso,
        };
        return [savedRecord, ...current.filter((entry) => entry.id !== existing.id)].slice(0, 20);
      }

      savedRecord = {
        id: `package-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        sourceEmailSubject,
        carrier,
        merchant,
        itemLabel,
        status,
        deliveryDate,
        trackingNumber,
        statusHistory: status ? [status] : [],
        arrivingToday: isTodayDeliveryLabel(deliveryDate),
        arrivingTomorrow: isTomorrowDeliveryLabel(deliveryDate),
        summary,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      return [savedRecord, ...current].slice(0, 20);
    });

    if (deps.gatewayConfig?.features.memory && savedRecord) {
      void importPackageMemory([savedRecord])
        .then(() => memoryListPackages())
        .then((items) => deps.setRustPackageMemory(items))
        .catch(() => undefined);
    }

    return savedRecord;
  }

  function rememberMeetingPrepSummary(
    eventTitle: string,
    summaryTitle: string,
    focusSummary: string,
    actionItems: string[],
    relatedPeople: string[],
    changesSinceLastPrep: string | null,
    summary: string,
  ) {
    const record: MeetingPrepMemoryRecord = {
      id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventTitle,
      summaryTitle,
      focusSummary,
      actionItems,
      relatedPeople,
      changesSinceLastPrep,
      summary,
      createdAt: new Date().toISOString(),
    };

    deps.setMeetingPrepMemory((current) => [record, ...current].slice(0, 12));
    if (deps.gatewayConfig?.features.memory) {
      void importMeetingPrepMemory([record])
        .then(() => memoryListMeetingPrep())
        .then((items) => deps.setRustMeetingPrepMemory(items))
        .catch(() => undefined);
    }
    return record;
  }

  function rememberSchoolPlan(
    title: string,
    focusSummary: string,
    subjects: string[],
    sessions: string[],
    assignments: string[],
    examCountdowns: string[],
    summary: string,
  ) {
    const record: SchoolPlanMemoryRecord = {
      id: `school-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      focusSummary,
      subjects,
      sessions,
      assignments,
      examCountdowns,
      summary,
      createdAt: new Date().toISOString(),
    };

    deps.setSchoolPlanMemory((current) => [record, ...current].slice(0, 12));
    if (deps.gatewayConfig?.features.memory) {
      void importSchoolPlanMemory([record])
        .then(() => memoryListSchoolPlans())
        .then((items) => deps.setRustSchoolPlanMemory(items))
        .catch(() => undefined);
    }
    return record;
  }

  return {
    rememberPersonBirthday,
    updatePersonMemory,
    rememberTravelSummary,
    rememberExpenseSummary,
    rememberPackageSummary,
    rememberMeetingPrepSummary,
    rememberSchoolPlan,
  };
}
