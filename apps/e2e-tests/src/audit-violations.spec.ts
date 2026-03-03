/**
 * E2E tests for audit-formatter rule detection on the violations fixture.
 *
 * Fixture: a11y-violations.html
 *   Five elements with intentional violations:
 *     #icon-btn         — empty aria-label → oracle/focus-missing-name
 *     #generic-div      — div[tabindex=0] with no role → oracle/focus-generic-role
 *     #positive-tab     — button with tabindex="5" → oracle/positive-tabindex
 *     #no-indicator-btn — outline:none → oracle/focus-not-visible
 *     #good-btn         — clean button (no violations)
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';
import { OracleAuditor } from '@a11y-oracle/audit-formatter';

test.describe('Audit Violations Fixture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/a11y-violations.html');
  });

  test('#no-indicator-btn triggers focus-not-visible', async ({
    a11y,
    page,
  }) => {
    await page.focus('#no-indicator-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();
    expect(state.focusIndicator.isVisible).toBe(false);
  });

  test('#positive-tab has tabIndex > 0', async ({ a11y, page }) => {
    await page.focus('#positive-tab');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();
    expect(state.focusedElement).not.toBeNull();
    expect(state.focusedElement!.tabIndex).toBeGreaterThan(0);
  });

  test('#icon-btn triggers focus-missing-name', async ({ a11y, page }) => {
    await page.focus('#icon-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();
    expect(state.focusedElement).not.toBeNull();
    // aria-label="" means the computed name is empty
    expect(state.speechResult).not.toBeNull();
    expect(state.speechResult!.name.trim()).toBe('');
  });

  test('#generic-div triggers focus-generic-role', async ({ a11y, page }) => {
    await page.focus('#generic-div');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();
    expect(state.focusedElement).not.toBeNull();
    // div with no ARIA role has generic/none/presentation role in AX tree
    expect(state.speechResult).not.toBeNull();
    const rawRole = state.speechResult!.rawNode?.role?.value ?? '';
    expect(['generic', 'none', 'presentation']).toContain(rawRole);
  });

  test('#good-btn passes all checks', async ({ a11y, page }) => {
    await page.focus('#good-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();
    expect(state.focusIndicator.isVisible).toBe(true);
    expect(state.focusedElement).not.toBeNull();
    expect(state.focusedElement!.tabIndex).toBeLessThanOrEqual(0);
  });

  test('OracleAuditor catches all 4 state-based rules', async ({
    a11y,
  }) => {
    const auditor = new OracleAuditor(a11y, {
      project: 'e2e-tests',
      specName: 'audit-violations.spec.ts',
    });

    // Tab through all elements
    for (let i = 0; i < 6; i++) {
      await auditor.pressKey('Tab');
    }

    const issues = auditor.getIssues();
    const ruleIds = issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('oracle/positive-tabindex');
    expect(ruleIds).toContain('oracle/focus-not-visible');
    expect(ruleIds).toContain('oracle/focus-missing-name');
    expect(ruleIds).toContain('oracle/focus-generic-role');
  });
});
