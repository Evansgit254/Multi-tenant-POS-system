import { test, expect } from '@playwright/test';

test.describe('Login Interactions', () => {
  test('Should navigate to Registration and back to Login', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    
    // Check initial state
    await expect(page.locator('h1').getByText('Welcome Back!')).toBeVisible();
    
    // Click Go to Registration
    await page.getByText('Go to Registration').click();
    
    // Check URL and View
    await expect(page).toHaveURL(/.*view=register/);
    await expect(page.locator('h1').getByText('Create Account')).toBeVisible();
    await expect(page.getByPlaceholder('Hotel Name')).toBeVisible();
    
    // Click Back to Login (using 'Back to Login' link which appears instead of 'Forgot password')
    await page.getByText('Back to Login').click();
    await expect(page).toHaveURL('http://localhost:5174/login');
    await expect(page.locator('h1').getByText('Welcome Back!')).toBeVisible();
  });

  test('Should navigate to Forgot Password', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    
    // Click Forgot password
    await page.getByText('Forgot password?').click();
    
    // Check URL and View
    await expect(page).toHaveURL(/.*view=forgot/);
    await expect(page.locator('h1').getByText('Password Recovery')).toBeVisible();
  });

  test('Facebook OAuth Mock should authenticate and redirect', async ({ page }) => {
    await page.goto('http://localhost:5174/login');
    
    // Click Facebook button
    const fbBtn = page.getByText('Add Facebook account');
    await expect(fbBtn).toBeVisible();
    await fbBtn.click();
    
    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:5174/', { timeout: 10000 });
    
    // Expect to be on dashboard (URL is exactly / or similar)
    expect(page.url()).toBe('http://localhost:5174/');
  });
});
