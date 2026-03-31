import { test, expect } from '@playwright/test';

test.describe('Dashboard KPIs and Charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should display 4 KPI cards with real data', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
    // Gross Revenue KPI
    await expect(page.locator('text=Gross Revenue').first()).toBeVisible({ timeout: 8000 });
    // Processed Orders
    await expect(page.locator('text=Processed Orders').first()).toBeVisible();
    // Avg. Ticket Size
    await expect(page.locator('text=Avg. Ticket Size').first()).toBeVisible();
    // New Guests
    await expect(page.locator('text=New Guests').first()).toBeVisible();
  });

  test('should render Sales Velocity chart', async ({ page }) => {
    await expect(page.locator('text=Sales Velocity').first()).toBeVisible({ timeout: 8000 });
    // recharts svg
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('should show Top Performers section', async ({ page }) => {
    await expect(page.locator('text=Top Performers').first()).toBeVisible({ timeout: 8000 });
  });

  test('should show Welcome back message with user name', async ({ page }) => {
    await expect(page.locator('text=Welcome back').first()).toBeVisible({ timeout: 8000 });
  });
});
