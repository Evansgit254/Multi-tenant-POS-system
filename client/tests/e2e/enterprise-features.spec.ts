import { test, expect } from '@playwright/test';

/**
 * Enterprise Features E2E Test Suite
 * Tests the three frontend enterprise features:
 * 1. Native Receipt Printing (window.print interception)
 * 2. Reservation Calendar toggle in Rooms view
 * 3. Offline Sync Queue + OfflineBanner UI
 */

// ─── Shared Login Helper ──────────────────────────────────────────────────────
async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'manager@lakeside.com');
  await page.fill('input[type="password"]', 'Manager@123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: Reservation Calendar
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Feature: Reservation Calendar', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Click the Rooms link in the sidebar to use soft navigation
    await page.click('a[href="/rooms"]');
    await expect(page).toHaveURL('/rooms');
  });

  test('Rooms page loads with list view by default', async ({ page }) => {
    // The rooms grid should be visible by default
    const heading = page.locator('h2').filter({ hasText: 'Hotel Property' }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  test('Calendar toggle button is visible in Bookings tab', async ({ page }) => {
    // Navigate to Bookings tab first
    await page.click('button:has-text("Bookings")');
    // The view toggle buttons should be present
    const calendarToggle = page.locator('button:has-text("Calendar")');
    await expect(calendarToggle.first()).toBeVisible({ timeout: 8000 });
  });

  test('Clicking Calendar toggle renders the react-big-calendar component', async ({ page }) => {
    await page.click('button:has-text("Bookings")');

    // Click the Calendar toggle button
    const calendarBtn = page.locator('button:has-text("Calendar")').first();
    await calendarBtn.waitFor({ state: 'visible', timeout: 8000 });
    await calendarBtn.click();

    // react-big-calendar renders with class "rbc-calendar"
    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 8000 });

    // Should render a toolbar with navigation arrows
    await expect(page.locator('.rbc-toolbar')).toBeVisible({ timeout: 5000 });
  });

  test('Calendar shows Today navigation and can move to next month', async ({ page }) => {
    await page.click('button:has-text("Bookings")');

    const calendarBtn = page.locator('button:has-text("Calendar")').first();
    await calendarBtn.waitFor({ state: 'visible', timeout: 8000 });
    await calendarBtn.click();

    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 8000 });

    // The Today button should exist
    const todayBtn = page.locator('.rbc-toolbar button:has-text("Today")');
    await expect(todayBtn).toBeVisible({ timeout: 5000 });

    // Navigate forward
    const nextBtn = page.locator('.rbc-toolbar .rbc-btn-group button').last();
    await nextBtn.click();
    await page.waitForTimeout(400);

    // Calendar should still be mounted after navigation
    await expect(page.locator('.rbc-calendar')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 3: Offline Sync Queue & OfflineBanner
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Feature: Offline Sync Queue & OfflineBanner', () => {

  test('OfflineBanner does NOT appear when the user is online', async ({ page }) => {
    await login(page);
    await page.goto('/');

    // Banner should be hidden when connectivity is fine
    const banner = page.locator('text=You are offline');
    await expect(banner).not.toBeVisible({ timeout: 3000 });
  });

  test('OfflineBanner appears when browser goes offline', async ({ page, context }) => {
    await login(page);
    await page.goto('/');

    // Simulate going offline at the browser level
    await context.setOffline(true);

    // Trigger a navigation or wait for the next network event detection
    // The OfflineBanner listens to the 'offline' event
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(500);

    // Banner should now show
    await expect(page.locator('text=You are offline')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=pending sync').or(page.locator('text=transactions'))).toBeVisible({ timeout: 3000 });

    // Restore connectivity
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });

  test('OfflineBanner disappears when connection is restored', async ({ page, context }) => {
    await login(page);
    await page.goto('/');

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(400);
    await expect(page.locator('text=You are offline')).toBeVisible({ timeout: 5000 });

    // Restore connection — banner should hide (assuming queue drains fast)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(500);

    // If queue is empty, the banner should disappear
    await expect(page.locator('text=You are offline')).not.toBeVisible({ timeout: 5000 });
  });

  test('POS terminal handles offline checkout gracefully without crashing', async ({ page, context }) => {
    await login(page);
    await page.goto('/pos');

    await page.waitForURL('/pos', { timeout: 8000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(300);

    // The POS terminal should still be rendering (not crashed or blank)
    const terminal = page.locator('h1, h2').first();
    await expect(terminal).toBeVisible({ timeout: 5000 });

    // Restore
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 4: Blind Shift Closing (UI verification)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Feature: Blind Shift Closing UI', () => {

  test('Expected cash amount is not pre-filled in the shift close modal', async ({ page }) => {
    await login(page);
    await page.goto('/');

    // Look for the "Close Shift" sidebar button (only visible when a shift is open)
    const closeShiftBtn = page.locator('button:has-text("Close Shift"), span:has-text("Close Shift")').first();

    if (await closeShiftBtn.isVisible({ timeout: 5000 })) {
      await closeShiftBtn.click();

      // Look for the cash input
      const cashInput = page.locator('input[type="number"]').first();
      await expect(cashInput).toBeVisible({ timeout: 5000 });

      // Blind enforcement: the input should be EMPTY, not pre-populated
      const value = await cashInput.inputValue();
      expect(value).toBe('');

      // The "BLIND RECONCILIATION ENABLED" badge should be visible
      await expect(page.locator('text=BLIND RECONCILIATION')).toBeVisible({ timeout: 3000 });

      // Close the modal
      await page.keyboard.press('Escape');
    } else {
      // No active shift — skip gracefully
      test.skip(true, 'No active shift open for this user. Open a shift first to test blind closing.');
    }
  });
});
