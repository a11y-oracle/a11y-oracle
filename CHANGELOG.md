## 1.1.2 (2026-03-05)

### 🩹 Fixes

- **focus-analyzer:** detect rgba-transparent outlines and extract outermost box-shadow color ([aad7063](https://github.com/a11y-oracle/a11y-oracle/commit/aad7063))

### ❤️ Thank You

- Claude Opus 4.6
- Preston Lamb @pjlamb12

## 1.1.1 (2026-03-05)

### 🩹 Fixes

- **visual-engine,axe-bridge:** scroll element into viewport before CDP screenshot ([2d8e536](https://github.com/a11y-oracle/a11y-oracle/commit/2d8e536))

### ❤️ Thank You

- Claude Opus 4.6
- Preston Lamb @pjlamb12

## 1.1.0 (2026-03-05)

### 🩹 Fixes

- **axe-bridge:** attach measured contrast ratio to resolved violation and pass nodes ([58ad7e5](https://github.com/a11y-oracle/a11y-oracle/commit/58ad7e5))

### ❤️ Thank You

- Claude Opus 4.6
- Preston Lamb @pjlamb12

# 1.0.0 (2026-03-04)

### 🚀 Features

- scaffold Nx workspace and sandbox app (Phase 1) ([#1](https://github.com/a11y-oracle/a11y-oracle/issues/1))
- implement core speech engine with CDP integration (Phase 2) ([#2](https://github.com/a11y-oracle/a11y-oracle/issues/2))
- add Playwright plugin with E2E tests (Phase 3) ([#3](https://github.com/a11y-oracle/a11y-oracle/issues/3))
- add Cypress plugin with E2E tests (Phase 4) ([#4](https://github.com/a11y-oracle/a11y-oracle/issues/4))
- add keyboard-engine library with CDP key dispatch ([#5](https://github.com/a11y-oracle/a11y-oracle/issues/5))
- add focus-analyzer library with WCAG contrast, tab order, and trap detection ([1d8ec0b](https://github.com/a11y-oracle/a11y-oracle/commit/1d8ec0b))
- add A11yOrchestrator with unified A11yState in core-engine ([e14971d](https://github.com/a11y-oracle/a11y-oracle/commit/e14971d))
- add keyboard/focus testing to plugins with sandbox fixtures and E2E tests ([f0974a2](https://github.com/a11y-oracle/a11y-oracle/commit/f0974a2))
- add audit-formatter library with axe-core-compatible issue output ([#9](https://github.com/a11y-oracle/a11y-oracle/issues/9))
- add 3 keyboard-navigation rules (missing-name, generic-role, positive-tabindex) ([58a10fb](https://github.com/a11y-oracle/a11y-oracle/commit/58a10fb))
- add versioned WCAG filtering, issue dedup, bug fixes, and E2E tests ([77f72cc](https://github.com/a11y-oracle/a11y-oracle/commit/77f72cc))
- add visual-engine and axe-bridge libraries for incomplete color contrast resolution ([#10](https://github.com/a11y-oracle/a11y-oracle/issues/10))
- replace pngjs with fast-png for browser compatibility + add E2E tests ([d1f9017](https://github.com/a11y-oracle/a11y-oracle/commit/d1f9017))
- derive contrast thresholds from WcagLevel instead of hardcoding ([#11](https://github.com/a11y-oracle/a11y-oracle/issues/11))
- **axe-bridge:** add 9 incomplete rule resolvers with resolveAllIncomplete orchestrator ([#12](https://github.com/a11y-oracle/a11y-oracle/pull/12))

### 🩹 Fixes

- production hardening — CDP typo, null guards, type fix, E2E coverage, selector escaping ([046dc92](https://github.com/a11y-oracle/a11y-oracle/commit/046dc92))

### ❤️ Thank You

- Claude Opus 4.6
- Preston Lamb @pjlamb12