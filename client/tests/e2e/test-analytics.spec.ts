import { test, expect } from '@playwright/test';

test('capture visual analytics screenshot', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'manager@lakeside.com');
  await page.fill('input[type="password"]', 'Manager@123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
  
  await page.goto('/reports');
  await expect(page.locator('text=Overview Charts')).toBeVisible();
  await page.click('button:has-text("Overview Charts")');
  await page.waitForTimeout(2000); // Wait for charts/data to load
  await page.screenshot({ path: '/home/evans/.gemini/antigravity/brain/ffdec1c3-1a11-48ab-a469-cc54140c6ad0/report_visual.png', fullPage: true });
});
