import { expect, test } from '@playwright/test';

test('desktop home keeps three primary modes above the fold and persists safe setup in the URL', async ({
  page,
}) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/?lang=eng&t=240');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose how you want to play');
  await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /TV Display/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multiplayer/ })).toBeVisible();
  await expect(page.locator('select')).toHaveValue('eng');
  await expect(page.getByText('4 min', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeDisabled();

  await page.getByRole('button', { name: 'TV Display' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'TV Display setup' })).toBeVisible();
  await expect(page).toHaveURL(/mode=tv/);

  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await page.getByRole('button', { name: '+1 min' }).click();
  await expect(page.getByText('10 min', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/t=600/);

  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'TV Display setup' })).toBeVisible();
  await expect(page.getByText('10 min', { exact: true })).toBeVisible();
  await expect(page.locator('select')).toHaveValue('eng');
  await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /TV Display/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multiplayer/ })).toBeVisible();

  expect(consoleMessages).toEqual([]);
});

test('mobile home keeps the three primary mode cards visible and duration clamps safely', async ({
  page,
}) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=spa&t=120');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose how you want to play');
  await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /TV Display/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multiplayer/ })).toBeVisible();

  await page.getByRole('button', { name: '−1 min' }).click();
  await page.getByRole('button', { name: '−1 min' }).click();
  await page.getByRole('button', { name: '−1 min' }).click();
  await expect(page.getByText('1 min', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/t=60/);

  await page.getByRole('button', { name: 'Multiplayer' }).click();
  await expect(page).toHaveURL(/mode=multiplayer/);
  await page.goBack();
  await expect(page).toHaveURL(/mode=solo/);
  await expect(page.getByRole('heading', { level: 3, name: 'Solo play setup' })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/mode=multiplayer/);
  await expect(page.getByRole('heading', { level: 3, name: 'Multiplayer setup' })).toBeVisible();

  expect(consoleMessages).toEqual([]);
});
