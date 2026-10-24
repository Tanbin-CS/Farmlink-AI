import { expect, test } from '@playwright/test';

// The welcome tour is covered by its own test; other flows start with it dismissed.
test.beforeEach(async ({ page }, info) => {
  if (!info.title.includes('welcome tour')) {
    await page.addInitScript(() => localStorage.setItem('farmlink.tour.seen.v1', '1'));
  }
});

test('guided sandbox: demo → cash flow → financing → draft → confirm → receipt → evidence', async ({ page, isMobile }) => {
  await page.goto('./');
  await expect(page.getByText('Competition prototype. Sandbox only. No real loan, payment, or lender submission.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(/#\/workspace$/);
  await expect(page.getByRole('heading', { name: 'Sandbox Demo Cooperative (fictional)' })).toBeVisible();
  await expect(page.getByText(/Cash runs out in 7 days/)).toBeVisible();
  await expect(page.getByText('BDT 425,000').first()).toBeVisible();

  // Refreshing a hash route works on static hosting.
  await page.goto('./#/cashflow');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cash-flow forecast' })).toBeVisible();

  await page.goto('./#/financing');
  await expect(page.getByText(/Seasonal Crop Line A has the lowest modeled cost/)).toBeVisible();
  await page.getByRole('button', { name: /Repayment stress test/ }).first().click();
  await expect(page.getByText('Harvest receipts 14 days late').first()).toBeVisible();
  await page.getByRole('button', { name: 'Draft application' }).first().click();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/#\/applications$/);
  await expect(page.getByTestId('application-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Review exact terms' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('FarmLink internal lender simulator').first()).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Confirm sandbox submission' });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByTestId('review-stress')).toContainText('survive only 0 of 4 adverse scenarios');
  await dialog.getByRole('checkbox', { name: /I reviewed these exact terms/ }).check();
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /fail 4 of 4 stress scenarios/ }).check();
  await confirm.click();
  await expect(dialog.getByTestId('receipt')).toBeVisible();
  await expect(dialog.getByText('Local sandbox receipt — browser only')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Sandbox submitted').first()).toBeVisible();

  await page.goto('./#/activity');
  await expect(page.getByText('confirm_sandbox_submission').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence bundle' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^farmlink-evidence-guided_local-/);

  await page.goto('./#/about');
  await expect(page.getByText('Deployed frontend commit:')).toBeVisible();
  if (!isMobile) await expect(page.getByRole('complementary', { name: 'Copilot' })).toBeVisible();
});

test('guided copilot buttons run deterministic tools and log events', async ({ page, isMobile }) => {
  await page.goto('./#/workspace');
  const main = page.getByRole('main');
  await main.getByRole('radio', { name: 'USD' }).click();
  await expect(main.getByRole('radio', { name: 'USD' })).toHaveAttribute('aria-checked', 'true');
  await main.getByRole('button', { name: 'Load sandbox demo scenario' }).click();
  await expect(page.getByText(/USD 3,400/).first()).toBeVisible();
  if (isMobile) await page.goto('./#/copilot');
  const panel = page.getByRole('complementary', { name: 'Copilot' });
  await expect(panel.getByText('Guided sandbox — no live AI.')).toBeVisible();
  await panel.getByRole('button', { name: 'Analyze cash flow' }).click();
  await expect(panel.getByText(/Largest shortfall/)).toBeVisible();
  await panel.getByRole('button', { name: 'Compare financing' }).click();
  await expect(panel.getByText(/lowest modeled cost/)).toBeVisible();
  await expect(panel.getByText(/Stress test of the cheapest option/)).toBeVisible();
  await panel.getByRole('button', { name: 'Create draft and review' }).click();
  await expect(page.getByRole('dialog').getByText('Review and confirm sandbox submission')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel submission' }).click();
  await page.goto('./#/activity');
  await expect(page.getByText('cancel_sandbox_submission').first()).toBeVisible();
});

test('what-if scenario changes the projected gap without changing records', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText(/Cash runs out in 7 days/)).toBeVisible();
  await page.goto('./#/cashflow');
  await page.getByRole('button', { name: 'Input and operating costs 15% higher' }).click();
  await expect(page.getByText('What-if gap')).toBeVisible();
  await expect(page.getByText('+BDT 129,750')).toBeVisible();
  await page.getByRole('button', { name: 'Reset scenario' }).click();
  await expect(page.getByText('What-if gap')).toHaveCount(0);
});

test('welcome tour explains the demo once, and the command palette navigates', async ({ page, isMobile }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  const tour = page.getByRole('dialog');
  await expect(tour.getByText('Meet the demo cooperative')).toBeVisible();
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByText(/Cash runs out on/)).toBeVisible();
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'See the forecast' }).click();
  await expect(page).toHaveURL(/#\/cashflow$/);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (!isMobile) {
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/Where do you want to go/).fill('financing');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/financing$/);
  }
});

test('clicking the forecast chart shows that day in detail', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText(/Cash runs out in 7 days/)).toBeVisible();
  await page.goto('./#/cashflow');
  await expect(page.getByText('Click any day on the chart')).toBeVisible();
  const chart = page.locator('.recharts-wrapper').first();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
  await expect(page.getByText('Selected day')).toBeVisible();
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByText('Selected day')).toBeVisible();
});

test('the page keeps scrolling with the mouse wheel after dialogs open and close', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse wheel is a desktop interaction');
  await page.goto('./');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText(/Cash runs out in 7 days/)).toBeVisible();
  await page.goto('./#/setup');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await page.mouse.move(700, 600);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('lenis-stopped'))).toBe(false);
});

test('explainer video autoplays (muted until the visitor interacts) when scrolled into view', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('heading', { name: 'FarmLink AI in under two minutes' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('video')?.scrollIntoView({ block: 'center' }));
  const player = page.locator('iframe[title="FarmLink AI explainer video"]');
  await expect(player).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/In0M4g6hLow\?autoplay=1&mute=[01]&/);
  // Browsers allow sound only after the visitor has interacted; otherwise it starts muted with a one-tap sound button.
  const startedMuted = /mute=1/.test((await player.getAttribute('src')) ?? '');
  const sound = page.getByRole('button', { name: 'Tap for sound' });
  if (startedMuted) {
    await sound.click();
    await expect(sound).toHaveCount(0);
    await expect(player).toHaveAttribute('src', /mute=1/); // unmuted through the player API, no reload
  } else {
    await expect(sound).toHaveCount(0);
  }
});

test('reduced-motion visitors get click-to-play instead of autoplay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.evaluate(() => document.getElementById('video')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play the FarmLink AI explainer video' }).click();
  await expect(page.locator('iframe[title="FarmLink AI explainer video"]')).toHaveAttribute('src', /autoplay=1&mute=0/);
});
