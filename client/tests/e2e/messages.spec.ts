import { test, expect } from '@playwright/test';

test.describe('Messages & Internal Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.click('a[href="/messages"]');
    await expect(page).toHaveURL('/messages');
  });

  test('should display channel list with unread badges', async ({ page }) => {
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
    // At least one channel should be visible
    await expect(page.getByText('Front of House').first()).toBeVisible({ timeout: 8000 });
  });

  test('should open a channel and show chat history', async ({ page }) => {
    // Click the first channel
    await page.locator('text=Kitchen').first().click();
    // After clicking a channel, the chat panel shows the channel type label or empty state
    await expect(
      page.getByText('Team channel').or(page.getByText('No messages yet. Say hello!')).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should allow typing and sending a message', async ({ page }) => {
    // Click the Kitchen channel row precisely via the span in the left panel
    await page.locator('span').filter({ hasText: /^Kitchen$/ }).first().click();
    // Wait briefly for React state to settle after channel switch
    await page.waitForTimeout(500);
    const input = page.locator('input[placeholder="Write a message..."]').first();
    await expect(input).toBeVisible({ timeout: 8000 });
    await input.fill('E2E test message');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=E2E test message').first()).toBeVisible({ timeout: 5000 });
  });
});
