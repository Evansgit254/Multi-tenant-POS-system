import { test, expect } from '@playwright/test';

test.describe('Settings Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL('/settings');
  });

  test('should load settings page with tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    // Tab navigation should exist
    await expect(page.getByText('Identity').first()).toBeVisible({ timeout: 8000 });
  });

  test('should show Hotel Profile form fields', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Hotel"], label:has-text("Hotel")').first()).toBeVisible({ timeout: 8000 });
  });

  test('should navigate between settings tabs', async ({ page }) => {
    // Try to find at least two tabs
    const tabs = page.locator('button[class*="tab"], nav button');
    const tabCount = await tabs.count();
    if (tabCount > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
      await expect(page.locator('h2, h3, section').first()).toBeVisible();
    }
  });

  test('should display staff user management section', async ({ page }) => {
    // The Vault Security section handles roles and access
    await expect(page.getByText('Vault').first()).toBeVisible({ timeout: 8000 });
  });
});
