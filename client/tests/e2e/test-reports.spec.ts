import { test, expect } from '@playwright/test';

test('capture reports screenshots', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'manager@lakeside.com');
  await page.fill('input[type="password"]', 'Manager@123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
  
  await page.goto('/reports');
  await page.waitForTimeout(2000); // wait for data to load
  await page.screenshot({ path: '/home/evans/.gemini/antigravity/brain/ffdec1c3-1a11-48ab-a469-cc54140c6ad0/report_history.png' });

  await page.click('button:has-text("Z-Reading / Shift")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/evans/.gemini/antigravity/brain/ffdec1c3-1a11-48ab-a469-cc54140c6ad0/report_shift.png', fullPage: true });

  await page.click('button:has-text("Tax & Compliance")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/evans/.gemini/antigravity/brain/ffdec1c3-1a11-48ab-a469-cc54140c6ad0/report_tax.png' });

  await page.click('button:has-text("Inventory Valuation")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/evans/.gemini/antigravity/brain/ffdec1c3-1a11-48ab-a469-cc54140c6ad0/report_inventory.png', fullPage: true });
});
