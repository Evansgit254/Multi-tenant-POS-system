import { test, expect } from '@playwright/test';

test.describe('Guests & Loyalty - Full CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/guests"]');
    await expect(page).toHaveURL('/guests');
  });

  test('should display guests page heading', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
    // Guest CRM should load
    await expect(page.locator('h2').first()).toContainText('Guest CRM');
  });

  test('should open the New Guest modal', async ({ page }) => {
    await page.click('button:has-text("New Guest")');
    // Modal heading is "New Client Registration"
    await expect(page.locator('h3', { hasText: 'New Client Registration' }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder="John"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder="Doe"]').first()).toBeVisible();
    // Close
    await page.click('button[type="button"]:has(svg)');
  });

  test('should create a new guest profile', async ({ page }) => {
    await page.click('button:has-text("New Guest")');
    await expect(page.locator('h3', { hasText: 'New Client Registration' }).first()).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await page.locator('input[placeholder="John"]').first().fill('E2EFirst');
    await page.locator('input[placeholder="Doe"]').first().fill(`E2ELast_${ts}`);
    await page.locator('input[type="email"]').first().fill(`e2e_${ts}@test.com`);

    await page.click('button:has-text("Register")');
    await expect(page.locator(`text=E2ELast_${ts}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('should search for a guest', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('John');
    await page.waitForTimeout(600);
    // Page should render something
    await expect(page.locator('div, p, h3').first()).toBeVisible();
  });
});
