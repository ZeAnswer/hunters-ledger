import { test, expect } from '@playwright/test';

test('block builder: build Adjust for Range from scratch, JSON matches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: '+ New' }).click();
  const sheet = page.locator('.fixed.inset-0');
  await sheet.getByLabel('Name').fill('Test Archer');
  await sheet.getByLabel(/^Id/).fill('test-archer');
  // WHEN: ALL of [attack is ranged, log miss this target this round]
  const condSelects = sheet.locator('select').filter({ hasText: 'ALL of' }); // condition kind selects
  await condSelects.first().selectOption('all');
  await sheet.getByRole('button', { name: '+ add condition' }).click();
  await condSelects.nth(1).selectOption('attack.kind');
  await sheet.getByRole('button', { name: '+ add condition' }).click();
  await condSelects.nth(2).selectOption('log');
  // DO: bonus attack +4
  const valueInput = sheet.getByPlaceholder('value or expr');
  await valueInput.fill('4');
  await page.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}/builder.png` : 'test-results/builder.png', fullPage: false });
  await sheet.getByRole('button', { name: 'JSON' }).click();
  const json = JSON.parse(await sheet.locator('textarea').inputValue());
  expect(json).toMatchObject({
    id: 'test-archer', name: 'Test Archer', source: 'feat', activation: 'passive',
    effects: [{
      trigger: 'always',
      when: { kind: 'all', of: [{ kind: 'attack.kind', attackKind: 'ranged' }, { kind: 'log', event: 'miss', target: 'current', scope: 'thisRound' }] },
      do: [{ kind: 'bonus', to: 'attack', value: 4, bonusType: 'untyped' }],
    }],
  });
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Test Archer')).toBeVisible();
  await page.getByRole('button', { name: 'add' }).first().click();
});
