import { test, expect } from '@playwright/test';

test('an older install merges newer built-in packs on startup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Battle' })).toBeVisible();
  await page.waitForTimeout(1200); // let the first save flush
  // Pretend this install only ever saw bestiary v1 with one monster missing.
  await page.evaluate(async () => {
    const { get, set } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
    const lib = await get('hl.library');
    delete lib.monsters['bestiary-tarrasque'];
    for (const k of Object.keys(lib.meta)) if (lib.meta[k].packId === 'bestiary') lib.meta[k].version = 1;
    await set('hl.library', lib);
  });
  await page.reload();
  await expect(page.getByText(/Updated built-in packs: Hunter's Bestiary/)).toBeVisible();
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Monsters', exact: true }).first().click();
  await page.getByPlaceholder('Search monsters…').fill('tarrasque');
  await expect(page.getByText('Tarrasque')).toBeVisible();
});
