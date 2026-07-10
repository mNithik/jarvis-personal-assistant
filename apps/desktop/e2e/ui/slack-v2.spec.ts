import { expect, test } from "@playwright/test";

import { installTauriMock } from "../fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Command" }).click();
});

test("slack file upload approval flow", async ({ page }) => {
  const invoke = async (cmd: string, args?: Record<string, unknown>) =>
    page.evaluate(
      async ({ cmd, args }) =>
        (
          window as unknown as {
            __TAURI_INTERNALS__: {
              invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
            };
          }
        ).__TAURI_INTERNALS__.invoke(cmd, args),
      { cmd, args },
    );

  await invoke("gateway_run_turn", {
    request: { command: "upload file to slack #general from report.pdf", source: "text" },
  });

  await expect
    .poll(async () => {
      const approvals = (await invoke("list_pending_gateway_approvals")) as Array<{
        id: string;
      }>;
      return approvals.length;
    })
    .toBe(1);

  const approvals = (await invoke("list_pending_gateway_approvals")) as Array<{
    id: string;
  }>;
  await invoke("gateway_approve", { approvalId: approvals[0]?.id });

  await expect
    .poll(async () => {
      const pending = (await invoke("list_pending_gateway_approvals")) as Array<{
        id: string;
      }>;
      return pending.length;
    })
    .toBe(0);
});
