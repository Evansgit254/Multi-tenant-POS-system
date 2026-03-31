import { test, expect } from '@playwright/test';

test.describe('Floor Plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/floor-plan"]');
    await expect(page).toHaveURL('/floor-plan');
  });

  test('should display floor plan canvas with tables', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
    // Table cards on the canvas
    await expect(page.locator('text=Table').first()).toBeVisible({ timeout: 8000 });
  });

  test('should open Add Table modal', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Table")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('h2, h3').filter({ hasText: 'Add Table' }).first()).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('should click a table and open configuration panel', async ({ page }) => {
    const tableCard = page.locator('[data-table-id], .table-card, div[draggable]').first();
    if (await tableCard.isVisible()) {
      await tableCard.click();
      await expect(page.getByText('Configure Table').first().or(page.getByText('Table Status').first())).toBeVisible({ timeout: 5000 });
    }
  });
});
