import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Gateway" }).click();
});

test("lab toggles and mobile approve render", async ({ page }) => {
  await expect(page.getByTestId("lab-mobile-approve-toggle")).toBeVisible();
  await expect(page.getByTestId("lab-council-runtime-toggle")).toBeVisible();
  await expect(page.getByTestId("lab-world-model-toggle")).toBeVisible();
});

test("gateway settings persist mobile approve", async ({ page }) => {
  const toggle = page.getByTestId("lab-mobile-approve-toggle");
  await toggle.check();
  await page.getByTestId("gateway-save-button").click();
  await expect(toggle).toBeChecked();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Command" }).click();
  await page.getByTestId("harness-nav").getByRole("button", { name: "Gateway" }).click();
  await expect(page.getByTestId("lab-mobile-approve-toggle")).toBeChecked();
});
