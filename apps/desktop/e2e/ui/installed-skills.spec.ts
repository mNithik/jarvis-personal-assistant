import { test, expect } from "@playwright/test";

test("installed skills list renders", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  await expect(page.getByTestId("installed-skills-panel")).toBeVisible();
  await expect(page.getByText("Hello skill")).toBeVisible();
  await expect(page.getByText("[global]")).toBeVisible();
});

test("installed skills refresh when active profile overrides a global skill", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  await expect(page.getByText("Hello skill")).toBeVisible();
  await expect(page.getByText("[global]")).toBeVisible();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-personal").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/personal/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  await expect(page.getByText("Personal Hello skill")).toBeVisible();
  await expect(page.getByText("[profile:personal]")).toBeVisible();
  await expect(page.getByText("hello skill, dinner plan")).toBeVisible();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-work").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/work/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  await expect(page.getByText("Hello skill")).toBeVisible();
  await expect(page.getByText("[global]")).toBeVisible();
  await expect(page.getByText("Personal Hello skill")).toHaveCount(0);
});
