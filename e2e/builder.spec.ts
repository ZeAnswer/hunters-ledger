import { test, expect } from '@playwright/test';

test('block builder: build Adjust for Range from selectors, JSON matches v2', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: '+ New' }).click();
  const sheet = page.locator('.fixed.inset-0');
  await sheet.getByLabel('Name').fill('Test Archer');
  await sheet.getByLabel(/^Id/).fill('test-archer');
  const forms = sheet.locator('[data-role="cond-form"]');
  // root is ALL of []; add child 1 → compare attack.kind = ranged
  await sheet.getByRole('button', { name: '+ add condition' }).first().click();
  await forms.nth(1).selectOption('compare');
  await sheet.locator('[data-role="sel-domain"]').first().selectOption('attack');
  await sheet.locator('[data-role="sel-field"]').first().selectOption('kind');
  await sheet.locator('[data-role="cond-op"]').first().selectOption('=');
  await sheet.locator('[data-role="cond-value"]').first().selectOption('ranged');
  // child 2 → history (defaults: I missed this target this round)
  await sheet.getByRole('button', { name: '+ add condition' }).first().click();
  await forms.nth(2).selectOption('history');
  // DO: default modify attack 1 → 4
  await sheet.getByPlaceholder(/e.g. 2, wisMod/).fill('4');
  await sheet.getByRole('button', { name: 'JSON' }).click();
  const json = JSON.parse(await sheet.locator('textarea').inputValue());
  expect(json).toMatchObject({
    id: 'test-archer', name: 'Test Archer', origin: 'feat', activation: 'passive',
    effects: [{
      trigger: 'always',
      when: { all: [{ compare: 'attack.kind', op: '=', value: 'ranged' }, { history: { event: 'miss', by: 'me', vs: 'current', scope: 'thisRound' }, op: '>=', value: 1 }] },
      do: [{ verb: 'modify', to: 'attack', value: 4, type: 'untyped', mode: 'add' }],
    }],
  });
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Test Archer')).toBeVisible();
});
