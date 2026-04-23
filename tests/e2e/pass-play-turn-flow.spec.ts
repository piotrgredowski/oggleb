import { expect, test } from '@playwright/test';

test('pass and play turn flow uses private handoff screens and one shared board', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/?lang=eng&t=180&mode=multiplayer');

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByLabel('Player 2 name').fill('Bea');
  await page.getByRole('button', { name: 'Start pass-and-play round' }).click();

  await expect(page.getByTestId('pass-play-handoff')).toBeVisible();
  await expect(page.getByText('Ada, get ready for your turn.')).toBeVisible();
  await expect(page.getByTestId('pass-play-active-words')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start Ada’s turn' }).click();
  const firstBoard = await page.getByTestId('board-cell').allInnerTexts();
  await expect(page.getByTestId('timer-chip')).toHaveText('03:00');

  await page.getByLabel('Word entry').fill('TEST');
  await page.getByRole('button', { name: 'Add word' }).click();
  await expect(page.getByTestId('pass-play-active-words')).toContainText('TEST');
  await page.getByRole('button', { name: 'End Ada’s turn' }).click();

  await expect(page.getByTestId('pass-play-turn-complete')).toBeVisible();
  await expect(page.getByText('Ada’s turn is locked in.')).toBeVisible();
  await expect(page.getByText('TEST')).toHaveCount(0);

  await page.getByRole('button', { name: 'Continue to next player' }).click();
  await expect(page.getByTestId('pass-play-handoff')).toBeVisible();
  await expect(page.getByText('Bea, get ready for your turn.')).toBeVisible();
  await expect(page.getByText('TEST')).toHaveCount(0);
  await expect(page).not.toHaveURL(/Ada|Bea|TEST|score|turn=/i);

  await page.getByRole('button', { name: 'Start Bea’s turn' }).click();
  await expect(page.getByTestId('timer-chip')).toHaveText('03:00');
  await expect(page.getByTestId('pass-play-active-player')).toHaveText('Bea');
  await expect(page.getByTestId('pass-play-active-words')).toContainText('No words entered yet.');
  await expect(page.getByTestId('board-cell')).toHaveText(firstBoard);

  expect(consoleMessages).toEqual([]);
});

test('pass and play mobile flow keeps handoff private and guards in-round controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=eng&t=180&mode=multiplayer');

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByLabel('Player 2 name').fill('Bea');
  await page.getByRole('button', { name: 'Start pass-and-play round' }).click();

  await expect(page.getByTestId('pass-play-handoff')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Ada’s turn' })).toBeInViewport();
  await page.getByRole('button', { name: 'Start Ada’s turn' }).click();

  await page.getByLabel('Word entry').click();
  await page.getByLabel('Word entry').fill('WORD');
  await expect(page.getByRole('button', { name: 'Add word' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'End Ada’s turn' })).toBeInViewport();
  await expect(page.getByTestId('pass-play-active-player')).toHaveText('Ada');

  await page.getByRole('button', { name: /TV Display/ }).click();
  await expect(page.getByTestId('pass-play-abandon-guard')).toBeVisible();
  await expect(page.getByText('Leave pass-and-play and abandon this local round?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep current round' }).click();
  await expect(page.getByTestId('pass-play-active-player')).toHaveText('Ada');

  await page.getByRole('button', { name: /TV Display/ }).click();
  await page.getByRole('button', { name: 'Abandon round' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'TV Display setup' })).toBeVisible();
  await expect(page.getByTestId('pass-play-active-player')).toHaveCount(0);
});
