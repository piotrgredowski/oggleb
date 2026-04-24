import { expect, test } from '@playwright/test';

test('shared host flow shows lobby details and copy feedback before start', async ({ page }) => {
  await page.goto('/?lang=eng&t=240&mode=multiplayer');

  await page.getByRole('button', { name: /Host a shared round/ }).click();

  await expect(page.getByTestId('shared-lobby')).toBeVisible();
  await expect(page.getByTestId('shared-code-pill')).toContainText('Code:');
  await expect(page.getByTestId('shared-lobby').getByText('Language: English')).toBeVisible();
  await expect(page.getByTestId('shared-lobby').getByText('Board: 4×4')).toBeVisible();
  await expect(page.getByTestId('shared-lobby').getByText('Timer: 4 min')).toBeVisible();
  await expect(page.locator('select[aria-label="Language"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: '+1 min' })).toBeDisabled();

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByTestId('shared-copy-feedback')).toContainText('Copied shared code.');
});

test('shared join accepts raw code and full link while invalid input stays inline', async ({ page }) => {
  await page.goto('/?lang=eng&t=180&mode=multiplayer');
  await page.getByRole('button', { name: /Host a shared round/ }).click();

  const codeText = await page.getByTestId('shared-code-pill').textContent();
  const rawCode = codeText?.replace('Code:', '').trim() ?? '';
  const shareLink = await page.getByRole('textbox', { name: 'Shareable link' }).inputValue();

  await page.getByRole('button', { name: 'Back to multiplayer' }).click();
  await page.getByRole('button', { name: 'Open join helper' }).click();
  await page.getByRole('textbox', { name: 'Shared code or join link' }).fill('bad-code');
  await page.getByRole('button', { name: 'Join shared round' }).click();
  await expect(page.getByTestId('shared-join-error')).toContainText('not supported');
  await expect(page).toHaveURL(/mp=join/);

  await page.getByRole('textbox', { name: 'Shared code or join link' }).fill(rawCode);
  await page.getByRole('button', { name: 'Join shared round' }).click();
  await expect(page.getByTestId('shared-lobby')).toBeVisible();
  await expect(page).toHaveURL(/g=/);

  await page.getByRole('button', { name: 'Back to multiplayer' }).click();
  await page.getByRole('button', { name: 'Open join helper' }).click();
  await page.getByRole('textbox', { name: 'Shared code or join link' }).fill(shareLink);
  await page.getByRole('button', { name: 'Join shared round' }).click();
  await expect(page.getByTestId('shared-lobby')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Shareable link' })).toHaveValue(shareLink);
});

test('shared deep links and browser history restore safe multiplayer states', async ({ page }) => {
  await page.goto('/?lang=eng&t=180&mode=multiplayer');
  await page.getByRole('button', { name: /Host a shared round/ }).click();
  const shareLink = page.url();

  await page.goto(shareLink);
  await expect(page.getByTestId('shared-lobby')).toBeVisible();
  await expect(page.getByTestId('shared-lobby').getByText('Language: English')).toBeVisible();

  await page.goto('/?g=BAD-CODE');
  await expect(page.getByRole('heading', { level: 2, name: 'Multiplayer setup' })).toBeVisible();
  await expect(page.getByTestId('shared-join-error')).toContainText('not supported');

  await page.goto('/?lang=eng&t=180&mode=multiplayer');
  await page.getByRole('button', { name: 'Open join helper' }).click();
  await expect(page).toHaveURL(/mp=join/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/mode=multiplayer/);

  await page.getByRole('button', { name: /Host a shared round/ }).click();
  await expect(page).toHaveURL(/g=/);
  await page.goBack();
  await expect(page).toHaveURL(/mode=multiplayer$/);
  await expect(page.getByText('Host a shared round')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('shared-lobby')).toBeVisible();
});
