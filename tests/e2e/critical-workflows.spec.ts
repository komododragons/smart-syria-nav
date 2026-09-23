import { expect, test } from "@playwright/test";

test("resolve, delivery, and emergency modes keep their intended public context", async ({ page }) => {
  await page.goto("/a/SY-DAM-9M4Q");
  await expect(page.getByText("SY-DAM-9M4Q").first()).toBeVisible();

  await page.goto("/d/SY-DAM-9M4Q");
  await expect(page.locator("body")).not.toContainText("private_notes");

  await page.goto("/e/SY-DAM-9M4Q");
  await expect(page.locator("body")).not.toContainText("owner_id");
});

test("Arabic and English switch page direction", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const languageToggle = page.getByRole("button", { name: "التبديل إلى الإنجليزية" });
  await expect(languageToggle).toBeEnabled();
  await languageToggle.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("scanner manual fallback rejects unrelated text", async ({ page }) => {
  await page.goto("/scan");
  const field = page.getByRole("textbox");
  await field.fill("not-an-address");
  await page.getByRole("button", { name: /فتح العنوان|Open address/i }).click();
  await expect(page).toHaveURL(/\/scan/);
});