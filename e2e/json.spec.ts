import { test, expect } from "@playwright/test";

// Lance d'abord: pnpm dev
test("page dev json-test", async ({ page }) => {
  await page.goto("/dev/json-test");
  await page.getByRole("textbox").first().fill('{"a":1}');
  await expect(page.getByText("nodes")).toBeVisible();
});
