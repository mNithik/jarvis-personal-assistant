import { expect, test } from "@playwright/test";

import { installTauriMock } from "../fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Gateway" }).click();
});

test("refreshes remote marketplace catalog", async ({ page }) => {
  await page.getByTestId("marketplace-refresh-catalog").click();
  await expect(page.getByText("Refreshed remote marketplace catalog.")).toBeVisible();
  await expect(page.getByTestId("marketplace-catalog")).toBeVisible();
});

test("operator panel shows proactive metrics", async ({ page }) => {
  await expect(page.getByTestId("operator-panel")).toBeVisible();
  await expect(page.getByTestId("operator-proactive-metrics")).toContainText("dismiss rate");
});
