import { test, expect } from '@playwright/test';

test.describe('POS Terminal and Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@lakeside.com');
    await page.fill('input[type="password"]', 'Manager@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should add items to cart and checkout via M-Pesa', async ({ page }) => {
    await page.click('a[href="/pos"]');
    await expect(page.locator('h2').first()).toContainText('Ticket');

    await page.click('text=Cappuccino Test');

    // Check if it's in the cart
    await expect(page.locator('div', { hasText: 'Cappuccino Test' }).first()).toBeVisible();

    // Click Checkout button ('Order Now')
    await page.click('button:has-text("Order Now")');

    // Click M-Pesa payment method
    await page.click('button:has-text("M-Pesa")');

    // Check for success overlay
    await expect(page.locator('h3', { hasText: 'Order Success' }).first()).toBeVisible();
  });
});
