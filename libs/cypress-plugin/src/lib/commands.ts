/**
 * @module commands
 *
 * Custom Cypress commands for accessibility speech testing and
 * keyboard/focus analysis.
 *
 * Uses `Cypress.automation('remote:debugger:protocol')` to communicate
 * with Chrome DevTools Protocol directly through Cypress's own CDP
 * connection — no external libraries or Node-side tasks required.
 *
 * This is the same proven pattern used by cypress-real-events.
 *
 * ## Cypress iframe architecture
 *
 * Cypress runs the AUT (app under test) inside an iframe within
 * its runner page. This module handles:
 * - Scoping accessibility tree queries to the AUT frame via `frameId`
 * - Executing `Runtime.evaluate` in the AUT frame via `contextId`
 * - Focusing the AUT iframe before dispatching keyboard events
 *
 * @example
 * ```typescript
 * // In your test:
 * cy.initA11yOracle();
 * cy.a11yPress('Tab').should('contain', 'Home');
 * cy.a11yPressKey('Tab').then(state => {
 *   expect(state.focusIndicator.meetsWCAG_AA).to.be.true;
 * });
 * cy.disposeA11yOracle();
 * ```
 */

import { SpeechEngine, A11yOrchestrator } from '@a11y-oracle/core-engine';
import type {
  CDPSessionLike,
  SpeechResult,
  A11yState,
  A11yOrchestratorOptions,
  TabOrderReport,
  TraversalResult,
  ModifierKeys,
} from '@a11y-oracle/core-engine';
import { KEY_DEFINITIONS } from '@a11y-oracle/keyboard-engine';
import {
  formatAllIssues,
  formatTrapIssue,
} from '@a11y-oracle/audit-formatter';
import type { AuditContext } from '@a11y-oracle/audit-formatter';

// ── Type declarations ──────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Initialize A11y-Oracle. Must be called before other a11y commands.
       * Typically called in `beforeEach()`.
       */
      initA11yOracle(options?: A11yOrchestratorOptions): Chainable<null>;

      /**
       * Press a keyboard key via CDP and return the speech for the
       * newly focused element.
       *
       * @param key - Key name (e.g. `'Tab'`, `'Enter'`, `'ArrowDown'`).
       */
      a11yPress(key: string): Chainable<string>;

      /** Get the speech string for the currently focused element. */
      getA11ySpeech(): Chainable<string>;

      /** Get the full {@link SpeechResult} for the currently focused element. */
      getA11ySpeechResult(): Chainable<SpeechResult | null>;

      /** Get speech output for every visible node in the accessibility tree. */
      getA11yFullTreeSpeech(): Chainable<SpeechResult[]>;

      /**
       * Press a key via CDP and return the unified accessibility state.
       *
       * @param key - Key name (e.g. `'Tab'`, `'Enter'`, `'ArrowDown'`).
       * @param modifiers - Optional modifier keys.
       */
      a11yPressKey(key: string, modifiers?: ModifierKeys): Chainable<A11yState>;

      /** Get the current unified accessibility state without pressing a key. */
      a11yState(): Chainable<A11yState>;

      /** Extract all tabbable elements in DOM tab order. */
      a11yTraverseTabOrder(): Chainable<TabOrderReport>;

      /**
       * Detect whether a container traps keyboard focus (WCAG 2.1.2).
       *
       * @param selector - CSS selector for the container to test.
       * @param maxTabs - Maximum Tab presses before declaring a trap. Default 50.
       */
      a11yTraverseSubTree(
        selector: string,
        maxTabs?: number
      ): Chainable<TraversalResult>;

      /**
       * Check the current focused element's focus indicator and report
       * any issues via `cy.task('logOracleIssues')`.
       *
       * Mirrors the pattern of `checkAccessibilityAndReport` for axe-core.
       * Issues are emitted as `OracleIssue[]` and can be accumulated in
       * `setupNodeEvents` for end-of-run reporting.
       *
       * @param context - Optional audit context. Defaults to current spec name and project from env.
       */
      a11yCheckFocusAndReport(context?: Partial<AuditContext>): Chainable<void>;

      /**
       * Check a container for keyboard traps and report any issues via
       * `cy.task('logOracleIssues')`.
       *
       * @param selector - CSS selector for the container to test.
       * @param maxTabs - Maximum Tab presses before declaring a trap. Default 50.
       * @param context - Optional audit context.
       */
      a11yCheckTrapAndReport(
        selector: string,
        maxTabs?: number,
        context?: Partial<AuditContext>
      ): Chainable<void>;

      /**
       * Dispose A11y-Oracle and release resources.
       * Typically called in `afterEach()`.
       */
      disposeA11yOracle(): Chainable<null>;
    }
  }
}

// ── Internals ──────────────────────────────────────────────────────

let engine: SpeechEngine | null = null;
let orchestrator: A11yOrchestrator | null = null;
let autFrameId: string | null = null;
let autContextId: number | null = null;
let autIframeBounds: { x: number; y: number } | null = null;

/**
 * Send a raw CDP command through Cypress's automation channel.
 */
function sendCDP(
  command: string,
  params: Record<string, unknown> = {}
): Promise<any> {
  return (Cypress as any).automation('remote:debugger:protocol', {
    command,
    params,
  });
}

/**
 * Create a {@link CDPSessionLike} adapter that routes CDP calls through
 * Cypress's built-in `remote:debugger:protocol` automation channel.
 *
 * Automatically injects:
 * - The AUT iframe's `frameId` into `Accessibility.getFullAXTree` calls
 * - The AUT iframe's `contextId` into `Runtime.evaluate` calls
 *
 * This ensures all queries target the AUT content, not the Cypress
 * runner UI.
 */
function createFrameAwareCDPAdapter(): CDPSessionLike {
  return {
    send: (method: string, params?: Record<string, unknown>) => {
      const p = { ...params };

      // Scope AXTree to AUT frame
      if (method === 'Accessibility.getFullAXTree' && autFrameId) {
        p['frameId'] = autFrameId;
      }

      // Scope Runtime.evaluate to AUT frame's execution context
      if (method === 'Runtime.evaluate' && autContextId !== null) {
        p['contextId'] = autContextId;
      }

      // Translate iframe-relative clip coordinates to viewport coordinates.
      // Runtime.evaluate runs inside the AUT iframe (via contextId), so
      // getBoundingClientRect() returns iframe-relative coords. But
      // Page.captureScreenshot clips relative to the top-level viewport.
      if (
        method === 'Page.captureScreenshot' &&
        p['clip'] &&
        autIframeBounds &&
        (autIframeBounds.x !== 0 || autIframeBounds.y !== 0)
      ) {
        const clip = p['clip'] as Record<string, number>;
        p['clip'] = {
          ...clip,
          x: clip.x + autIframeBounds.x,
          y: clip.y + autIframeBounds.y,
        };
      }

      return sendCDP(method, p);
    },
  };
}

/**
 * Discover the AUT (app under test) iframe's frame ID
 * from the Cypress runner page's frame tree.
 *
 * The AUT frame is identified by having a URL that doesn't
 * contain `/__/` (runner), `__cypress` (spec iframe), or
 * `about:blank` (snapshot frames).
 */
async function findAUTFrameId(): Promise<string | null> {
  const result = await sendCDP('Page.getFrameTree');
  const childFrames = result.frameTree.childFrames || [];

  for (const child of childFrames) {
    const url: string = child.frame.url || '';
    if (
      url &&
      !url.includes('/__/') &&
      !url.includes('__cypress') &&
      url !== 'about:blank'
    ) {
      return child.frame.id;
    }
  }

  // Fallback: first child frame with a non-blank URL
  for (const child of childFrames) {
    if (child.frame.url && child.frame.url !== 'about:blank') {
      return child.frame.id;
    }
  }

  return null;
}

/**
 * Discover the execution context ID for the AUT frame.
 *
 * Creates an isolated world in the AUT frame, which shares the
 * same DOM (including `document.activeElement`, computed styles, etc.)
 * but has its own JavaScript scope. This ensures `Runtime.evaluate`
 * calls execute in the AUT, not the Cypress runner.
 */
async function findAUTContextId(frameId: string): Promise<number | null> {
  try {
    const result = await sendCDP('Page.createIsolatedWorld', {
      frameId,
      worldName: 'a11y-oracle',
      grantUniversalAccess: true,
    });
    return result.executionContextId;
  } catch {
    return null;
  }
}

/**
 * Get the AUT iframe's position in the top-level viewport.
 *
 * Runs `Runtime.evaluate` in the top-level context (without `contextId`)
 * to find the AUT iframe and return its bounding rect origin. Adds
 * `clientLeft`/`clientTop` to account for any iframe border.
 *
 * Used to translate iframe-relative coordinates from
 * `getBoundingClientRect()` to viewport-absolute coordinates for
 * `Page.captureScreenshot` clips.
 */
async function getAUTIframeBounds(): Promise<{ x: number; y: number }> {
  const result = (await sendCDP('Runtime.evaluate', {
    expression: `(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const f of iframes) {
        const src = f.getAttribute('src') || f.src || '';
        if (src && !src.includes('/__/') && !src.includes('__cypress') && src !== 'about:blank') {
          const rect = f.getBoundingClientRect();
          return { x: rect.x + f.clientLeft, y: rect.y + f.clientTop };
        }
      }
      return { x: 0, y: 0 };
    })()`,
    returnByValue: true,
  })) as { result: { value: { x: number; y: number } } };
  return result.result.value;
}

/**
 * Focus the AUT iframe element so that CDP keyboard events
 * reach the AUT's content instead of the Cypress runner UI.
 */
async function focusAUTFrame(): Promise<void> {
  try {
    // Get the runner page's document
    const doc = await sendCDP('DOM.getDocument', { depth: 0 });
    if (!doc?.root?.nodeId) return;

    // Find all iframes and focus the AUT one
    const iframes = await sendCDP('DOM.querySelectorAll', {
      nodeId: doc.root.nodeId,
      selector: 'iframe',
    });
    if (!iframes?.nodeIds) return;

    for (const nodeId of iframes.nodeIds) {
      try {
        const attrs = await sendCDP('DOM.getAttributes', { nodeId });
        const attrList: string[] = attrs.attributes;

        // Find the iframe whose src matches the AUT URL
        const srcIndex = attrList.indexOf('src');
        if (srcIndex >= 0) {
          const src = attrList[srcIndex + 1];
          if (
            src &&
            !src.includes('/__/') &&
            !src.includes('__cypress') &&
            src !== 'about:blank'
          ) {
            await sendCDP('DOM.focus', { nodeId });
            return;
          }
        }

        // Also check by name attribute (Cypress names AUT frames)
        const nameIndex = attrList.indexOf('name');
        if (nameIndex >= 0) {
          const name = attrList[nameIndex + 1];
          if (name && name.startsWith('Your project:')) {
            await sendCDP('DOM.focus', { nodeId });
            return;
          }
        }
      } catch {
        // Skip iframes we can't inspect
      }
    }
  } catch {
    // DOM query failed — frame focus is best-effort
  }
}

/**
 * Dispatch a real keyboard event (keyDown + keyUp) via CDP.
 */
async function dispatchKey(key: string): Promise<void> {
  const keyDef = KEY_DEFINITIONS[key];
  if (!keyDef) {
    const supported = Object.keys(KEY_DEFINITIONS).join(', ');
    throw new Error(
      `Unknown key: "${key}". Supported keys: ${supported}`
    );
  }

  // Ensure the AUT iframe has focus before each key dispatch
  await focusAUTFrame();

  await sendCDP('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: keyDef.key,
    code: keyDef.code,
    windowsVirtualKeyCode: keyDef.keyCode,
    nativeVirtualKeyCode: keyDef.keyCode,
  });

  await sendCDP('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: keyDef.key,
    code: keyDef.code,
    windowsVirtualKeyCode: keyDef.keyCode,
    nativeVirtualKeyCode: keyDef.keyCode,
  });
}

// ── Commands ───────────────────────────────────────────────────────

Cypress.Commands.add(
  'initA11yOracle',
  (options?: A11yOrchestratorOptions) => {
    cy.wrap(null, { log: false }).then(async () => {
      // Enable required CDP domains
      await sendCDP('DOM.enable');
      await sendCDP('Page.enable');

      // Discover the AUT frame
      autFrameId = await findAUTFrameId();
      if (!autFrameId) {
        throw new Error(
          'A11y-Oracle: Could not find the AUT iframe. ' +
            'Ensure cy.visit() was called before cy.initA11yOracle().'
        );
      }

      // Get the AUT frame's execution context for Runtime.evaluate
      autContextId = await findAUTContextId(autFrameId);

      // Cache iframe bounds for screenshot coordinate translation
      autIframeBounds = await getAUTIframeBounds();

      // Focus the AUT iframe so key events reach it
      await focusAUTFrame();

      // Create the CDP adapter that routes to the AUT frame
      const adapter = createFrameAwareCDPAdapter();

      // Create the speech engine scoped to the AUT frame
      engine = new SpeechEngine(adapter, options);
      await engine.enable();

      // Create the orchestrator for unified state
      orchestrator = new A11yOrchestrator(adapter, options);
      await orchestrator.enable();

      return null;
    });
  }
);

Cypress.Commands.add('a11yPress', (key: string) => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!engine) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }

    await dispatchKey(key);

    // Allow browser to update focus and ARIA states
    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await engine.getSpeech();
    return result?.speech ?? '';
  });
});

Cypress.Commands.add('getA11ySpeech', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!engine) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }
    const result = await engine.getSpeech();
    return result?.speech ?? '';
  });
});

Cypress.Commands.add('getA11ySpeechResult', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!engine) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }
    return (await engine.getSpeech()) ?? null;
  });
});

Cypress.Commands.add('getA11yFullTreeSpeech', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!engine) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }
    return engine.getFullTreeSpeech();
  });
});

Cypress.Commands.add('a11yPressKey', (key: string, modifiers?: ModifierKeys) => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!orchestrator) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }

    // Ensure the AUT iframe has focus before key dispatch
    await focusAUTFrame();

    return orchestrator.pressKey(key, modifiers);
  });
});

Cypress.Commands.add('a11yState', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!orchestrator) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }
    return orchestrator.getState();
  });
});

Cypress.Commands.add('a11yTraverseTabOrder', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (!orchestrator) {
      throw new Error(
        'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
      );
    }
    return orchestrator.traverseTabOrder();
  });
});

Cypress.Commands.add(
  'a11yTraverseSubTree',
  (selector: string, maxTabs?: number) => {
    cy.wrap(null, { log: false }).then(async () => {
      if (!orchestrator) {
        throw new Error(
          'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
        );
      }
      return orchestrator.traverseSubTree(selector, maxTabs);
    });
  }
);

/**
 * Build an AuditContext from optional overrides, falling back to
 * Cypress.spec.name and Cypress.env('projectName').
 */
function resolveAuditContext(
  overrides?: Partial<AuditContext>
): AuditContext {
  return {
    project: overrides?.project ?? Cypress.env('projectName') ?? '',
    specName: overrides?.specName ?? Cypress.spec.name,
    wcagLevel: overrides?.wcagLevel ?? Cypress.env('wcagLevel') ?? undefined,
    disabledRules:
      overrides?.disabledRules ?? Cypress.env('disabledRules') ?? undefined,
  };
}

Cypress.Commands.add(
  'a11yCheckFocusAndReport',
  (context?: Partial<AuditContext>) => {
    cy.wrap(null, { log: false }).then(async () => {
      if (!orchestrator) {
        throw new Error(
          'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
        );
      }
      const ctx = resolveAuditContext(context);
      const state = await orchestrator.getState();
      const issues = formatAllIssues(state, ctx);

      if (issues.length > 0) {
        cy.task(
          'log',
          `[A11y-Oracle] ${issues.length} focus issue(s) detected on ${ctx.specName}`
        );
        cy.task('logOracleIssues', issues).then(() => {
          if (Cypress.env('failOnErrors')) {
            throw new Error(
              `[A11y-Oracle] ${issues.length} focus indicator issue(s) detected: ${issues.map((issue) => issue.ruleId).join(', ')}`
            );
          }
        });
      }
    });
  }
);

Cypress.Commands.add(
  'a11yCheckTrapAndReport',
  (
    selector: string,
    maxTabs?: number,
    context?: Partial<AuditContext>
  ) => {
    cy.wrap(null, { log: false }).then(async () => {
      if (!orchestrator) {
        throw new Error(
          'A11y-Oracle not initialized. Call cy.initA11yOracle() first.'
        );
      }
      const ctx = resolveAuditContext(context);
      const result = await orchestrator.traverseSubTree(
        selector,
        maxTabs ?? 50
      );
      const issues = formatTrapIssue(result, selector, ctx);

      if (issues.length > 0) {
        cy.task(
          'log',
          `[A11y-Oracle] Keyboard trap detected in ${selector} on ${ctx.specName}`
        );
        cy.task('logOracleIssues', issues).then(() => {
          if (Cypress.env('failOnErrors')) {
            throw new Error(
              `[A11y-Oracle] Keyboard trap detected in ${selector}`
            );
          }
        });
      }
    });
  }
);

Cypress.Commands.add('disposeA11yOracle', () => {
  cy.wrap(null, { log: false }).then(async () => {
    if (orchestrator) {
      await orchestrator.disable();
      orchestrator = null;
    }
    if (engine) {
      // Engine was already disabled via orchestrator (same CDP session)
      engine = null;
    }
    autFrameId = null;
    autContextId = null;
    autIframeBounds = null;
    return null;
  });
});
