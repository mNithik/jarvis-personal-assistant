import { test, expect } from "@playwright/test";

function installedSkillsList(page: import("@playwright/test").Page) {
  return page.getByTestId("installed-skills-list");
}

test("installed skills list renders", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  await expect(page.getByTestId("installed-skills-panel")).toBeVisible();
  const installed = installedSkillsList(page);
  await expect(installed.getByText("Hello skill")).toBeVisible();
  await expect(installed.getByText("[global]")).toBeVisible();
});

test("installed skills refresh when active profile overrides a global skill", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  let installed = installedSkillsList(page);
  await expect(installed.getByText("Hello skill")).toBeVisible();
  await expect(installed.getByText("[global]")).toBeVisible();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-personal").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/personal/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  installed = installedSkillsList(page);
  await expect(installed.getByText("Personal Hello skill")).toBeVisible();
  await expect(installed.getByText("[profile:personal]")).toBeVisible();
  await expect(installed.getByText("hello skill, dinner plan")).toBeVisible();

  await page.getByTestId("harness-nav").getByRole("button", { name: "Profiles" }).click();
  await page.getByTestId("profile-switch-work").click();
  await expect(page.getByTestId("profile-active-label")).toContainText(/work/i);

  await page.getByTestId("harness-nav").getByRole("button", { name: "Skills" }).click();
  installed = installedSkillsList(page);
  await expect(installed.getByText("Hello skill")).toBeVisible();
  await expect(installed.getByText("[global]")).toBeVisible();
  await expect(installed.getByText("Personal Hello skill")).toHaveCount(0);
});
