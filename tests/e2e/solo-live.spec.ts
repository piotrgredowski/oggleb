import { expect, test } from '@playwright/test';

test('solo live play starts cleanly and keeps solver output hidden', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/?lang=eng&t=180&mode=solo');

  await expect(page.getByRole('heading', { level: 2, name: 'Solo play setup' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start solo round' })).toBeVisible();
  await expect(page.getByTestId('dictionary-status')).toContainText(/loading|ready/i);

  await page.getByRole('button', { name: 'Start solo round' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Solo round' })).toBeVisible();
  await expect(page.locator('[data-testid="board-cell"]')).toHaveCount(16);
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeEnabled();
  await expect(page.getByTestId('timer-chip')).toHaveText('03:00');
  await expect(page.getByTestId('solver-output')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart round' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Word entry' }).fill('tree');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.getByTestId('player-word-list')).toContainText('TREE');

  await page.getByRole('textbox', { name: 'Word entry' }).fill('TREE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.getByTestId('player-word-list').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('word-status')).toContainText('Already added');

  expect(consoleMessages).toEqual([]);
});

test('mobile solo live play keeps input reachable and warns before mutating setup', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=eng&t=120&mode=solo');

  await page.getByRole('button', { name: 'Start solo round' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Solo round' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Word entry' }).click();
  await expect(page.getByRole('button', { name: 'Add word' })).toBeInViewport();
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeInViewport();
  const timerBeforeGuard = await page.getByTestId('timer-chip').textContent();

  await page.getByRole('button', { name: '+1 min' }).click();
  await expect(page.getByTestId('round-guard')).toContainText('Restart to apply setup changes');
  expect(await page.getByTestId('timer-chip').textContent()).toBe(timerBeforeGuard);
  await expect(page.getByRole('button', { name: /show entered words/i })).toBeVisible();

  expect(consoleMessages).toEqual([]);
});
