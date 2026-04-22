import { expect, test } from '@playwright/test';

test('solo reveal and timeout land on the same results surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values[0] = 1;
        return values;
      },
    });
  });
  await page.goto('/?lang=eng&t=60&mode=solo');

  await page.getByRole('button', { name: 'Start solo round' }).click();
  await page.getByRole('textbox', { name: 'Word entry' }).fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'Reveal words' }).click();

  await expect(page.getByTestId('solver-output')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solo results' })).toBeVisible();
  await expect(page.getByText(/manual reveal now lands on the same scoring and inspection surface/i)).toBeVisible();
  await expect(page.getByTestId('player-results-list')).toContainText('FAVE');
  await expect(page.getByTestId('solver-results-list').locator('li').first()).toContainText(/[A-Z]{3,}/);

  await expect(page.getByRole('button', { name: 'Restart round' })).toBeVisible();

  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler) =>
      nativeSetInterval(handler, 5)) as typeof window.setInterval;
  });
  await page.goto('/?lang=eng&t=1&mode=solo');
  await page.getByRole('button', { name: 'Start solo round' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('solver-output')).toBeVisible();
  await expect(page.getByText(/timeout and manual reveal now share the same scoring and inspection surface/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart round' })).toBeVisible();
});

test('dictionary error on reveal lands in a terminal solo error state', async ({ page }) => {
  await page.route('**/en_dict_trie.js', async (route) => {
    await route.abort();
  });
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values[0] = 1;
        return values;
      },
    });
  });
  await page.goto('/?lang=eng&t=60&mode=solo');

  await expect(page.getByTestId('dictionary-status')).toContainText('Dictionary failed to load');
  await page.getByRole('button', { name: 'Start solo round' }).click();
  await page.getByRole('textbox', { name: 'Word entry' }).fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'Reveal words' }).click();

  await expect(page.getByTestId('solo-error-state')).toBeVisible();
  await expect(page.getByTestId('solo-error-state')).toContainText(
    'Results could not be produced because the dictionary failed to load.',
  );
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeDisabled();
  await expect(page.getByTestId('solver-output')).toHaveCount(0);

  await page.getByRole('button', { name: 'Restart round' }).click();
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeEnabled();
  await expect(page.getByTestId('solo-error-state')).toHaveCount(0);
});

test('dictionary error on timeout also lands in the same terminal solo error state', async ({ page }) => {
  await page.route('**/en_dict_trie.js', async (route) => {
    await route.abort();
  });
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values[0] = 1;
        return values;
      },
    });
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler) =>
      nativeSetInterval(handler, 5)) as typeof window.setInterval;
  });
  await page.goto('/?lang=eng&t=1&mode=solo');

  await expect(page.getByTestId('dictionary-status')).toContainText('Dictionary failed to load');
  await page.getByRole('button', { name: 'Start solo round' }).click();
  await page.waitForTimeout(500);

  await expect(page.getByTestId('solo-error-state')).toBeVisible();
  await expect(page.getByTestId('word-status')).toContainText(
    'Results could not be produced because the dictionary failed to load.',
  );
  await expect(page.getByRole('textbox', { name: 'Word entry' })).toBeDisabled();
  await expect(page.getByTestId('solver-output')).toHaveCount(0);
});

test('solo results show scoring, path inspection, and clean restart state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values[0] = 1;
        return values;
      },
    });
  });
  await page.goto('/?lang=eng&t=180&mode=solo');

  await page.getByRole('button', { name: 'Start solo round' }).click();
  await page.getByRole('textbox', { name: 'Word entry' }).fill('FAVE');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('textbox', { name: 'Word entry' }).fill('ZZZ');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByRole('button', { name: 'Reveal words' }).click();

  const scoreBeforeToggle = await page.getByTestId('player-score-total').textContent();
  await expect(page.getByTestId('player-results-list')).toContainText('FAVE');
  await expect(page.getByTestId('player-results-list')).toContainText('ZZZ');
  await expect(page.getByTestId('player-results-list')).toContainText('Valid');
  await expect(page.getByTestId('player-results-list')).toContainText('Invalid');

  const firstValidToggle = page.getByRole('checkbox', { name: /Count .* as unique/ }).first();
  await firstValidToggle.uncheck();
  await expect(page.getByTestId('player-score-total')).not.toHaveText(scoreBeforeToggle ?? '');

  const highlightedBefore = await page.locator('[data-testid="board-cell"][data-highlighted="true"]').count();
  await page.getByTestId('solver-results-list').getByRole('button').first().hover();
  expect(await page.locator('[data-testid="board-cell"][data-highlighted="true"]').count()).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-testid="board-cell"][data-highlighted="true"]')).toHaveCount(highlightedBefore);

  await page.getByRole('button', { name: 'Restart round' }).click();
  await expect(page.getByTestId('solver-output')).toHaveCount(0);
  await expect(page.getByTestId('player-word-list')).toContainText('No words entered yet.');
  await expect(page.getByTestId('word-status')).toContainText('Board ready. Start finding words.');
  await expect(page.locator('[data-testid="board-cell"][data-highlighted="true"]')).toHaveCount(0);
});
