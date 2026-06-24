import { test, expect } from "@playwright/test";

test("sync panel shows export and passphrase", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await expect(page.getByTestId("sync-export-button")).toBeVisible();
  await expect(page.getByTestId("sync-passphrase-input")).toBeVisible();
  await expect(page.getByText("Work launch checklist - active")).toBeVisible();
});

test("sync panel goals follow the active profile", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await expect(page.getByText("Work launch checklist - active")).toBeVisible();
  await expect(page.getByText("Personal dinner plan - active")).toHaveCount(0);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-personal").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/personal/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await expect(page.getByText("Personal dinner plan - active")).toBeVisible();
  await expect(page.getByText("Work launch checklist - active")).toHaveCount(0);
});

test("sync panel adds a goal into the active profile only", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-personal").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/personal/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await page.getByPlaceholder("New goal title").fill("Personal travel checklist");
  await page.getByRole("button", { name: "Add goal" }).click();
  await expect(page.getByText("Personal travel checklist - active")).toBeVisible();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-work").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/work/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await expect(page.getByText("Work launch checklist - active")).toBeVisible();
  await expect(page.getByText("Personal travel checklist - active")).toHaveCount(0);
});

test("sync panel shows export and import status messages", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("harness-nav").getByRole("button", { name: "Sync" }).click();
  await page.getByTestId("sync-passphrase-input").fill("secret-passphrase");
  await page.getByTestId("sync-export-button").click();
  await expect(page.getByText("Exported sync bundle to /tmp/export.jarvis-sync")).toBeVisible();

  await page.getByPlaceholder("Path to bundle file").fill("/tmp/export.jarvis-sync");
  await page.getByRole("button", { name: "Import bundle" }).click();
  await expect(page.getByText("Imported sync bundle")).toBeVisible();
});
