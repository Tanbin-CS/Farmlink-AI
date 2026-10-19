import { expect, test } from '@playwright/test';

test('guided sandbox: demo → cash flow → financing → draft → confirm → receipt → evidence', async ({ page, isMobile }) => {
  await page.goto('./');
  await expect(page.getByText('Competition prototype. Sandbox only. No real loan, payment, or lender submission.')).toBeVisible();
  await page.getByRole('button', { name: 'Start sandbox demo' }).click();
  await expect(page).toHaveURL(/#\/workspace$/);
  await expect(page.getByRole('heading', { name: 'Sandbox Demo Cooperative (fictional)' })).toBeVisible();
  await expect(page.getByText('BDT 4,25,000.00').first()).toBeVisible();

  // Refreshing a hash route works on static hosting.
  await page.goto('./#/cashflow');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cash-flow forecast' })).toBeVisible();

  await page.goto('./#/financing');
  await expect(page.getByText(/Seasonal Crop Line A has the lowest modeled cost/)).toBeVisible();
  await page.getByRole('button', { name: 'Draft application' }).first().click();
  await expect(page).toHaveURL(/#\/applications$/);
  await expect(page.getByTestId('application-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Prepare sandbox submission' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('FarmLink internal lender simulator').first()).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Confirm sandbox submission' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox').check();
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
  await page.getByRole('button', { name: 'Load sandbox demo scenario' }).first().click();
  if (isMobile) await page.goto('./#/copilot');
  const panel = page.getByRole('complementary', { name: 'Copilot' });
  await expect(panel.getByText('Guided sandbox — no live AI.')).toBeVisible();
  await panel.getByRole('button', { name: 'Analyze cash flow' }).click();
  await expect(panel.getByText(/Largest shortfall/)).toBeVisible();
  await panel.getByRole('button', { name: 'Compare financing' }).click();
  await expect(panel.getByText(/lowest modeled cost/)).toBeVisible();
  await panel.getByRole('button', { name: 'Create draft and review' }).click();
  await expect(page.getByRole('dialog').getByText('Review and confirm sandbox submission')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel submission' }).click();
  await page.goto('./#/activity');
  await expect(page.getByText('cancel_sandbox_submission').first()).toBeVisible();
});
