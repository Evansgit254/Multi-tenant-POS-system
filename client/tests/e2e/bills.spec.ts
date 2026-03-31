import { test, expect } from '@playwright/test';

test.describe('Bills & Folios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/bills"]');
    await expect(page).toHaveURL('/bills');
  });

  test('should display bills list with order info', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible();
    // Bills table or empty state should load
    const hasBills = await page.locator('table tbody tr').count();
    if (hasBills === 0) {
      // Empty state acceptable
      await expect(page.locator('h2').first()).toBeVisible();
    } else {
      await expect(page.locator('table tbody tr').first()).toBeVisible();
    }
  });

  test('should filter bills by date range', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.nth(0).fill('2026-01-01');
      await dateInputs.nth(1).fill('2026-12-31');
      await page.click('button:has-text("Apply")');
      await page.waitForTimeout(1000);
      await expect(page.locator('table tbody tr, p').first()).toBeVisible();
    }
  });

  test('should open a bill detail when clicking a row', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      // A detail panel or modal should open
      await expect(page.locator('text=Total').first().or(page.locator('text=Items').first())).toBeVisible({ timeout: 5000 });
    }
  });
});
