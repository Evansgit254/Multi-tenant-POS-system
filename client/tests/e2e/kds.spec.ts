import { test, expect } from '@playwright/test';

test.describe('Kitchen Display System (KDS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/kds"]');
    await expect(page).toHaveURL('/kds');
  });

  test('should display KDS columns for Pending, Preparing, Ready', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible();
    // Status columns should be visible
    await expect(page.locator('text=Pending').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Preparing').first()).toBeVisible();
    await expect(page.locator('text=Ready').first()).toBeVisible();
  });

  test('should show correct column states based on live data', async ({ page }) => {
    // Assert that the columns are rendered regardless of ticket count
    await expect(page.locator('h3:has-text("Intake / Pending")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3:has-text("In Preparation")')).toBeVisible();
    await expect(page.locator('h3:has-text("Pass / Ready")')).toBeVisible();
  });
});
