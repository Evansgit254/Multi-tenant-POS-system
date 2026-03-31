import { test, expect } from '@playwright/test';

test.describe('Menu Management - Full CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/menu"]');
    await expect(page).toHaveURL('/menu');
  });

  test('should display the menu items list with data', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
  });

  test('should open the Add New Item modal and find form', async ({ page }) => {
    await page.click('button:has-text("Add New Item")');
    // Modal heading
    await expect(page.locator('text=Add New Menu Item').first()).toBeVisible({ timeout: 5000 });
    // Inputs visible
    await expect(page.locator('input').first()).toBeVisible();
    // Close
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Add New Menu Item')).not.toBeVisible();
  });

  test('should create a new menu item', async ({ page }) => {
    await page.click('button:has-text("Add New Item")');
    await expect(page.locator('text=Add New Menu Item').first()).toBeVisible({ timeout: 5000 });

    const itemName = `E2E Item ${Date.now()}`;
    // Use exact placeholders to avoid matching the global Search input
    await page.locator('input[placeholder="Classic Burger"]').first().fill(itemName);
    
    // Select required category 
    await page.locator('select').first().selectOption({ index: 1 });
    
    // Price and Emoji inputs
    await page.locator('input[placeholder="10.00"]').first().fill('350');
    await page.locator('input[placeholder="🍔"]').first().fill('🥩');

    await page.click('button:has-text("Save Item")');
    await expect(page.locator(`text=${itemName}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('should switch to Categories tab', async ({ page }) => {
    await page.click('button:has-text("Categories")');
    await expect(page.locator('button:has-text("Add New Category")').first()).toBeVisible({ timeout: 5000 });
  });

  test('should open Edit modal for an existing menu item', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });
    // Click the Edit button in the first row
    await page.locator('table tbody tr').first().locator('button:has-text("Edit")').click();
    await expect(page.locator('text=Edit Menu Item').first()).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Cancel")');
  });
});
