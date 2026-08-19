import { test, expect } from '@playwright/test';

test('landing page loads and has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AI Support Platform/);
});
