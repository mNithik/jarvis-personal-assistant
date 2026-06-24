import { test, expect } from "@playwright/test";

test("profile switcher lists work and personal", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await expect(page.getByTestId("profile-switcher-panel")).toBeVisible();
  await page.getByTestId("profile-switch-personal").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/personal/i);
});
