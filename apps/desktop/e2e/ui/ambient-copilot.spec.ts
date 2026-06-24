import { test, expect } from "@playwright/test";

test("ambient copilot session and suggestion flow", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Ambient" }).click();
  await expect(page.getByTestId("ambient-copilot-panel")).toBeVisible();
  await page.getByTestId("ambient-consent-accept").click();
  await expect(page.getByText(/ambient copilot noticed/i)).toBeVisible();

  await page.evaluate(async () => {
    const invoke = (
      window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } }
    ).__TAURI_INTERNALS__.invoke;
    await invoke("record_ambient_signal_cmd", { signal: "quarterly review voice note" });
  });

  await page.getByTestId("harness-nav").getByRole("button", { name: "Gateway" }).click();
  await page.getByTestId("harness-nav").getByRole("button", { name: "Ambient" }).click();
  await expect(page.getByText(/quarterly review/i)).toBeVisible();

  await page
    .locator("article.proactive-nudge-card")
    .filter({ hasText: /quarterly review/i })
    .getByTestId("ambient-suggestion-dismiss")
    .click();
  await expect(page.getByText(/quarterly review/i)).toBeHidden();
});
