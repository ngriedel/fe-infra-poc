import { test, expect } from '@playwright/test';

/**
 * Spike: verify Maskito's `[maskito]` directive composes with Signal Forms'
 * `[formField]` on the same native input — i.e. typing applies the mask AND the
 * masked value flows back into the form model.
 */
test('Maskito number mask composes with Signal Forms [formField]', async ({ page }) => {
  await page.goto('/signal-forms');

  const amount = page.getByTestId('amount');
  await amount.waitFor(); // form appears after the mock load resolves

  await amount.click();
  await amount.pressSequentially('1234567');

  // 1. The mask formats the displayed value with thousand separators.
  await expect(amount).toHaveValue('1,234,567');

  // 2. The masked value is synced into the Signal Forms model (live JSON preview).
  await expect(page.locator('pre')).toContainText('"amount": "1,234,567"');
});
