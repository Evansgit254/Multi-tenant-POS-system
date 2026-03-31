import { test, expect } from '@playwright/test';

test.describe('Inventory Management - Full CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/inventory"]');
    await expect(page).toHaveURL('/inventory');
  });

  test('should display "Inventory Command" heading and table', async ({ page }) => {
    await expect(page.locator('text=Inventory Command').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8000 });
  });

  test('should open New Item modal', async ({ page }) => {
    await page.click('button:has-text("New Item")');
    await expect(page.locator('input[placeholder="e.g. Vintage Whiskey"]').first()).toBeVisible({ timeout: 5000 });
    // Discard Change button
    await page.click('button:has-text("Discard Change")');
  });

  test('should create a new inventory item', async ({ page }) => {
    await page.click('button:has-text("New Item")');
    await expect(page.locator('input[placeholder="e.g. Vintage Whiskey"]').first()).toBeVisible({ timeout: 5000 });

    const itemName = `E2E Stock ${Date.now()}`;
    await page.locator('input[placeholder="e.g. Vintage Whiskey"]').first().fill(itemName);
    await page.locator('input[placeholder="bottles, kg..."]').first().fill('boxes');
    
    // Initial stock
    await page.locator('input[placeholder="0"]').first().fill('50');

    await page.click('button:has-text("Commit New Item")');
    await expect(page.locator(`text=${itemName}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('should search inventory items by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('Coffee');
    await page.waitForTimeout(500);
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('should open edit modal via first row action button', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
    // Wait for the page 'fadeUp' CSS animation to settle (0.4s) before clicking to prevent bounding box misses
    await page.waitForTimeout(600);
    // Click the Edit button for the first row using accessibility label
    await page.getByRole('button', { name: /^Edit/ }).first().click();
    // Modal form fields appear
    await expect(page.locator('input[placeholder="e.g. Vintage Whiskey"]').first()).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Discard Change")');
  });
});
