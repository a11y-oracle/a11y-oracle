/**
 * @module @a11y-oracle/cypress-plugin
 *
 * Cypress plugin for A11y-Oracle accessibility speech testing.
 *
 * Import this module in your Cypress support file to register
 * custom commands that read the browser's accessibility tree
 * and produce standardized speech output.
 *
 * ## Setup
 *
 * ```typescript
 * // cypress/support/e2e.ts
 * import '@a11y-oracle/cypress-plugin';
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * describe('Navigation', () => {
 *   beforeEach(() => {
 *     cy.visit('/');
 *     cy.initA11yOracle();
 *   });
 *
 *   afterEach(() => {
 *     cy.disposeA11yOracle();
 *   });
 *
 *   it('Tab announces first menu item', () => {
 *     cy.a11yPress('Tab').should('contain', 'Home');
 *   });
 * });
 * ```
 *
 * ## Requirements
 *
 * - Chromium-based browser (Chrome, Edge, Electron)
 * - Cypress >= 12.0.0
 */

// Side-effect import: registers all custom Cypress commands
import './lib/commands.js';

// Re-export types for consumer convenience
export type {
  SpeechResult,
  SpeechEngineOptions,
  A11yState,
  A11yFocusedElement,
  A11yFocusIndicator,
  A11yOrchestratorOptions,
  ModifierKeys,
  TabOrderReport,
  TabOrderEntry,
  TraversalResult,
  FocusIndicator,
} from '@a11y-oracle/core-engine';
