import { test, expect } from '@playwright/test';

test.describe('Full System Navigation & Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Standard Manager Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    // Wait for the Dashboard to load fully
    await expect(page.locator('h1').first()).toContainText('ServePoint');
  });

  const routes = [
    '/pos',
    '/messages',
    '/bills',
    '/settings',
    '/rooms',
    '/menu',
    '/inventory',
    '/kds',
    '/floor-plan',
    '/guests',
    '/reports',
    '/procurement'
  ];

  for (const route of routes) {
    test(`should load the ${route} module successfully`, async ({ page }) => {
      console.log(`Testing route: ${route}`);
      // Click the sidebar link
      await page.click(`a[href="${route}"]`);
      
      // Wait for URL to change
      await expect(page).toHaveURL(route);
      
      // Verify that the main view mounted by checking for at least one heading (h1 or h2)
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  }
});
