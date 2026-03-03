/**
 * @module reporting
 *
 * Node-side setup for Oracle issue reporting in Cypress.
 *
 * Call `setupOracleReporting()` inside `setupNodeEvents()` in your
 * `cypress.config.ts` to register the `logOracleIssues` task and
 * automatically write a JSON report file at the end of each run.
 *
 * @example
 * ```typescript
 * // cypress.config.ts
 * import { setupOracleReporting } from '@a11y-oracle/cypress-plugin';
 *
 * export default defineConfig({
 *   e2e: {
 *     setupNodeEvents(on, config) {
 *       setupOracleReporting(on, config);
 *     },
 *     env: { projectName: 'my-app' },
 *   },
 * });
 * ```
 *
 * Or, to combine oracle issues with your existing axe-core violations
 * array, just add the `logOracleIssues` task yourself:
 *
 * ```typescript
 * on('task', {
 *   logAxeViolations(violations) { allViolations.push(...violations); return null; },
 *   logOracleIssues(issues) { allViolations.push(...issues); return null; },
 * });
 * ```
 */

/// <reference types="node" />
import * as fs from 'fs';

/**
 * Register Oracle reporting tasks and after:run hook.
 *
 * Registers:
 * - `logOracleIssues` task — accumulates OracleIssue objects in memory
 * - `after:run` hook — writes accumulated issues to
 *   `oracle-results-${projectName}.json`
 *
 * @param on - Cypress `on` function from `setupNodeEvents`
 * @param config - Cypress plugin config object
 */
export function setupOracleReporting(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): void {
  const allIssues: unknown[] = [];
  const projectName =
    (config.env?.['projectName'] as string) ?? 'default-project';

  on('task', {
    logOracleIssues(issues: unknown[]) {
      if (Array.isArray(issues)) {
        const enriched = issues.map((v: any) => ({
          ...v,
          project: v.project || projectName,
        }));
        allIssues.push(...enriched);
      }
      return null;
    },
  });

  on('after:run', () => {
    if (allIssues.length > 0) {
      const reportPath = `oracle-results-${projectName}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(allIssues, null, 2));
      console.log(`\n[A11y-Oracle] Report saved to ${reportPath}`);
      console.log(
        `[A11y-Oracle] Total issues found: ${allIssues.length}`
      );
    }
  });
}
