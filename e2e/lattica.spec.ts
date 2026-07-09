// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';

// ── Shell renders ──────────────────────────────────────────────────────────────

test('shell renders the topbar and three panes', async ({ page }) => {
  await page.goto('/');
  // Activity scope lanes present
  await expect(page.locator('.la-shell-activity-scope')).toBeVisible();
  // Three pane containers
  await expect(page.locator('.la-pane')).toHaveCount(3);
});

test('platform drawer opens and shows six module rows', async ({ page }) => {
  await page.goto('/');
  await page.locator('.la-shell-platform-btn').click();
  const rows = page.locator('.la-drawer-module-row');
  await expect(rows).toHaveCount(6);
});

// ── Layout persistence (M6) ────────────────────────────────────────────────────

test('pane layout persists across reload', async ({ page }) => {
  await page.goto('/');

  // Inject a non-default layout directly into localStorage
  await page.evaluate(() => {
    localStorage.setItem(
      'lattica.pane.tiles',
      JSON.stringify({ left: 'fossic', topRight: 'aistack', bottomRight: 'lumaweave' }),
    );
  });

  await page.reload();

  // After reload, the pane headers should show the persisted tile names
  const headers = page.locator('.la-pane-header-name');
  await expect(headers.nth(0)).toHaveText('fossic');
  await expect(headers.nth(1)).toHaveText('ai-stack');
  await expect(headers.nth(2)).toHaveText('lumaweave');
});

// ── Freeze / thaw (H4) ────────────────────────────────────────────────────────

test('freeze button shows overlay and thaw removes it', async ({ page }) => {
  await page.goto('/');

  const firstPane = page.locator('.la-pane').first();
  const freezeBtn = firstPane.locator('.la-pane-freeze-btn');

  await freezeBtn.click();
  await expect(firstPane.locator('.la-freeze-overlay')).toBeVisible();

  await firstPane.locator('.la-freeze-overlay button').click();
  await expect(firstPane.locator('.la-freeze-overlay')).not.toBeVisible();
});
