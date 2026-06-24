import { test, expect } from "@playwright/test";

test("edit trigger recipe schedule and payload", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Triggers" }).click();
  await expect(page.getByTestId("trigger-recipe-panel")).toBeVisible();
  await page.getByTestId("trigger-add-preset-morning_brief").click();
  await expect(page.getByRole("heading", { name: "Morning brief / plan" })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByPlaceholder("Schedule (HH:MM or minutes)").fill("08:15");
  await page.locator("textarea").fill('{\"command\":\"plan my day\"}');
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("morning_brief · 08:15")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Morning brief / plan" })).toHaveCount(0);
});
