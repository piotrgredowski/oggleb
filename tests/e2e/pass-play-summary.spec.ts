import { expect, test, type Page } from '@playwright/test';

function stubDeterministicSeed(page: Page) {
  return page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values[0] = 1;
        return values;
      },
    });
  });
}

test('pass and play summary shows winner details and replay clears private round state', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await stubDeterministicSeed(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/?lang=eng&t=180&mode=multiplayer');

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByLabel('Player 2 name').fill('Bea');
  await page.getByRole('button', { name: 'Start pass-and-play round' }).click();

  await page.getByRole('button', { name: 'Start Ada’s turn' }).click();
  const boardCells = await page.getByTestId('board-cell').allInnerTexts();
  await page.getByLabel('Word entry').fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByLabel('Word entry').fill('QQQ');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'End Ada’s turn' }).click();

  await page.getByRole('button', { name: 'Continue to next player' }).click();
  await page.getByRole('button', { name: 'Start Bea’s turn' }).click();
  await expect(page.getByTestId('board-cell')).toHaveText(boardCells);
  await page.getByLabel('Word entry').fill('ZZZ');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'End Bea’s turn' }).click();

  await expect(page.getByTestId('pass-play-summary')).toBeVisible();
  await expect(page.getByTestId('pass-play-winner-banner')).toContainText('Ada wins with 1 point');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('FAVE');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('Accepted');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('QQQ');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('Invalid word');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('1 pt');
  await expect(page.getByTestId('pass-play-player-summary-Bea')).toContainText('ZZZ');
  await expect(page.getByTestId('pass-play-player-summary-Bea')).toContainText('0 pts');
  await expect(page).not.toHaveURL(/Ada|Bea|FAVE|ZZZ|winner|score|turn=/i);

  await page.getByRole('button', { name: 'Play another pass-and-play round' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Pass-and-play roster' })).toBeVisible();
  await expect(page.getByLabel('Player 1 name')).toHaveValue('');
  await expect(page.getByLabel('Player 2 name')).toHaveValue('');
  await expect(page.getByText('Ada wins with 1 point')).toHaveCount(0);
  await expect(page.getByText('FAVE')).toHaveCount(0);

  expect(consoleMessages).toEqual([]);
});

test('pass and play summary resolves duplicates and zero-score ties cleanly', async ({ page }) => {
  await stubDeterministicSeed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=eng&t=180&mode=multiplayer');

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByLabel('Player 2 name').fill('Bea');
  await page.getByRole('button', { name: 'Start pass-and-play round' }).click();

  await page.getByRole('button', { name: 'Start Ada’s turn' }).click();
  await page.getByLabel('Word entry').fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'End Ada’s turn' }).click();

  await page.getByRole('button', { name: 'Continue to next player' }).click();
  await page.getByRole('button', { name: 'Start Bea’s turn' }).click();
  await page.getByLabel('Word entry').fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByLabel('Word entry').fill('ZZZ');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'End Bea’s turn' }).click();

  await expect(page.getByTestId('pass-play-summary')).toBeVisible();
  await expect(page.getByTestId('pass-play-winner-banner')).toContainText('It’s a tie at 0 points');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('Duplicate word');
  await expect(page.getByTestId('pass-play-player-summary-Bea')).toContainText('Duplicate word');
  await expect(page.getByTestId('pass-play-player-summary-Bea')).toContainText('Invalid word');
  await expect(page.getByTestId('pass-play-player-summary-Ada')).toContainText('0 pts');
  await expect(page.getByTestId('pass-play-player-summary-Bea')).toContainText('0 pts');
  await expect(page.getByRole('button', { name: 'Play another pass-and-play round' })).toBeVisible();
});
