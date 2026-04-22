import { expect, test } from '@playwright/test';

test('app shell boots and can open the classic board bridge', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.goto('/?lang=eng&t=240');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Oggleb redesign bootstrap');
  await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /TV Display/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Multiplayer/ })).toBeVisible();
  await expect(page.locator('select')).toHaveValue('eng');
  await expect(page.getByText('4 min')).toBeVisible();

  await page.getByRole('button', { name: 'Launch classic board' }).click();

  const frame = page.frameLocator('iframe[title="Legacy Oggleb board"]');
  await expect(frame.getByRole('button', { name: 'Jeszcze raz!' })).toBeVisible();
  await expect(frame.getByText('04:00')).toBeVisible();

  expect(consoleMessages).toEqual([]);
});
