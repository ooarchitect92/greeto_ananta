import { expect, test } from '@playwright/test';

test('customer login page exposes the primary authentication flow', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
});

test('admin login uses the dedicated admin entry point', async ({ page }) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /sign in to operations/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /continue securely/i })).toBeVisible();
});
