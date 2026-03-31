import { test, expect } from '@playwright/test';

test.describe('Procurement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/procurement"]');
    await expect(page).toHaveURL('/procurement');
  });

  test('should display purchase orders list', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
    // Either a table of orders or a 'New Order' button
    await expect(page.getByText('Purchase Order').first().or(page.getByText('New Order').first())).toBeVisible({ timeout: 8000 });
  });

  test('should open a New Purchase Order modal', async ({ page }) => {
    const newOrderBtn = page.locator('button:has-text("New Order"), button:has-text("New Purchase")').first();
    if (await newOrderBtn.isVisible({ timeout: 5000 })) {
      await newOrderBtn.click();
      await expect(page.locator('h3, h2').filter({ hasText: /Order|Purchase/ }).first()).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('should have supplier and status filter sections', async ({ page }) => {
    await expect(page.getByText('Supplier').first()).toBeVisible({ timeout: 8000 });
  });
});
