import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const invoke = (
      window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> } }
    ).__TAURI_INTERNALS__.invoke;
    await invoke("reset_topic_graph_cmd");
  });
});

test("topic graph panel loads nodes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Topic graph" }).click();
  await expect(page.getByTestId("topic-graph-panel")).toBeVisible();
  await expect(page.getByTestId("topic-graph-canvas")).toBeVisible();
  await expect(page.getByTestId("topic-graph-node-1")).toContainText("Product review");
});

test("topic graph neighbor drill-down", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Topic graph" }).click();
  await page.getByTestId("topic-graph-node-1").click();
  await expect(page.getByTestId("topic-graph-neighbors")).toContainText("Product review");
});

test("topic graph infer action updates relation status", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("harness-nav").getByRole("button", { name: "Topic graph" }).click();
  await page.getByRole("button", { name: "Infer relations" }).click();
  await expect(page.getByText("Inferred 2 relation(s).")).toBeVisible();
  await expect(page.getByText("2 entities · 2 relations")).toBeVisible();
  await expect(page.getByText(/Stakeholders.*mentions.*Product review/i)).toBeVisible();
});
