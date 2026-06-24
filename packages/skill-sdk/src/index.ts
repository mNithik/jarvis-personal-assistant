export type SkillHandler =
  | { type: "http"; url: string; method: string }
  | { type: "script"; command: string }
  | { type: "route"; capabilityId: string };

export type SkillManifest = {
  id: string;
  version: string;
  label: string;
  keywords: string[];
  agent: string;
  permissions: string[];
  enabled?: boolean;
  handler?: SkillHandler;
};

export function validateSkillManifest(manifest: SkillManifest): string[] {
  const errors: string[] = [];
  if (!manifest.id?.trim()) errors.push("id is required");
  if (!manifest.version?.trim()) errors.push("version is required");
  if (!manifest.label?.trim()) errors.push("label is required");
  if (!manifest.keywords?.length) errors.push("keywords are required");
  return errors;
}
