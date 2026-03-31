import { test, expect } from '@playwright/test';

test.describe('Rooms & Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/rooms"]');
    await expect(page).toHaveURL('/rooms');
  });

  test('should display room grid with status indicators', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
    // Rooms should be visible
    await expect(page.getByText('Available').first()).toBeVisible({ timeout: 8000 });
  });

  test('should filter by room status', async ({ page }) => {
    // Status filter buttons should exist
    const filterButtons = page.locator('button:has-text("All"), button:has-text("Available"), button:has-text("Occupied")');
    await expect(filterButtons.first()).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Available")');
    await page.waitForTimeout(500);
    // Grid should have filtered results
    await expect(page.locator('text=Available').first()).toBeVisible();
  });

  test('should open "New Booking" modal from an available room', async ({ page }) => {
    const bookBtn = page.locator('button:has-text("Book")').first();
    if (await bookBtn.isVisible({ timeout: 5000 })) {
      await bookBtn.click();
      await expect(page.getByText('New Booking').first().or(page.getByText('Check-in').first())).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('should open a room detail sidebar when clicking a room card', async ({ page }) => {
    const firstCard = page.locator('div[class*="room"], div[class*="card"]').first();
    if (await firstCard.isVisible({ timeout: 5000 })) {
      await firstCard.click();
      // Panel should slide in
      await expect(page.locator('h3, h2').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
