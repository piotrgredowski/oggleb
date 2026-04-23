import { expect, test } from '@playwright/test';

test('multiplayer entry makes same-device pass-and-play discoverable in one obvious step', async ({
  page,
}) => {
  const consoleMessages: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');

  await page.getByRole('button', { name: /Multiplayer/ }).click();
  await expect(page).toHaveURL(/mode=multiplayer/);
  await expect(page.getByRole('heading', { level: 3, name: 'Multiplayer setup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pass-and-play on this device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Host or join with a shared code' })).toBeVisible();

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Pass-and-play roster' })).toBeVisible();
  await expect(page.getByText('Same device')).toBeVisible();
  await expect(page.getByLabel('Player 1 name')).toBeVisible();
  await expect(page.getByLabel('Player 2 name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start pass-and-play round' })).toBeDisabled();
  await expect(page.getByLabel('Join code')).toHaveCount(0);
  await expect(page).toHaveURL(/mode=multiplayer/);
  await expect(page).not.toHaveURL(/Ada|Bea|p1|p2|roster=/i);

  expect(consoleMessages).toEqual([]);
});

test('pass and play setup blocks invalid states with inline feedback and no URL leaks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=eng&t=240&mode=multiplayer');

  await page.getByRole('button', { name: 'Pass-and-play on this device' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Pass-and-play roster' })).toBeVisible();

  const startButton = page.getByRole('button', { name: 'Start pass-and-play round' });
  await page.getByLabel('Player 2 active').uncheck();
  await expect(page.getByText('Add at least two players to start pass-and-play.')).toBeVisible();

  await page.getByLabel('Player 1 name').fill('Ada');
  await page.getByLabel('Player 2 active').check();
  await page.getByLabel('Player 2 name').fill('Ada');
  await expect(page.getByTestId('pass-play-roster-status')).toHaveText('Player names must be unique.');
  await expect(startButton).toBeDisabled();

  await page.getByLabel('Player 2 active').uncheck();
  await expect(page.getByText('Add at least two players to start pass-and-play.')).toBeVisible();
  await expect(startButton).toBeDisabled();

  await page.getByLabel('Player 2 active').check();
  await page.getByLabel('Player 2 name').fill('');
  await expect(page.getByTestId('pass-play-roster-status')).toHaveText('Player 2 needs a visible name.');
  await expect(startButton).toBeDisabled();

  await page.getByLabel('Player 2 name').fill('Bea');
  await expect(page.getByText('Roster ready for 2 players.')).toBeVisible();
  await expect(startButton).toBeEnabled();
  await expect(page).toHaveURL(/\?lang=eng&t=240&mode=multiplayer/);
  await expect(page).not.toHaveURL(/Ada|Bea|roster=|activePlayer=|words=|scores=/i);
});
