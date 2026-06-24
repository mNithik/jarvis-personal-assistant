import { test, expect } from "@playwright/test";

test("proactive nudge dismiss and acknowledge", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Nudges" }).click();
  await expect(page.getByTestId("proactive-nudge-panel")).toBeVisible();
  await page.getByTestId("proactive-nudge-acknowledge").click();
  await expect(page.getByTestId("proactive-nudge-panel")).toBeHidden();
  await page.reload();
  await page.getByTestId("harness-nav").getByRole("button", { name: "Nudges" }).click();
  await expect(page.getByTestId("proactive-nudge-panel")).toBeVisible();
  await page.getByTestId("proactive-nudge-dismiss").click();
  await expect(page.getByTestId("proactive-nudge-panel")).toBeHidden();
});
