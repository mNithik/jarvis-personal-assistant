import { test, expect } from "@playwright/test";

test("command preview updates after route", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Command" }).click();
  await page.getByTestId("command-input").fill("list trigger recipes");
  await page.getByRole("button", { name: "Route command" }).click();
  await expect(page.getByTestId("gateway-preview")).toContainText("Automation");
  await expect(page.getByTestId("gateway-preview")).toContainText("Matched workflow");
});
