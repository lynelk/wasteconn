import { test, expect } from '@playwright/test';

// Backend-independent smoke tests: prove the production build is served and the
// React app boots and mounts its shell. Data-driven flows need a seeded Base44
// tenant and belong in a separate, backend-backed suite.

test('serves the app shell', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Base44 APP/);
  await expect(page.locator('#root')).toBeAttached();
});

test('React mounts and renders content into #root', async ({ page }) => {
  await page.goto('/');
  // Before async auth resolves, the app renders its branded loader; either way
  // React must have rendered *something* into the root node.
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('an unknown route still serves the SPA shell', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-real-route');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#root')).toBeAttached();
});
