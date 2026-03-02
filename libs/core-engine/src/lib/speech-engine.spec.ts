import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Protocol } from 'devtools-protocol';
import { SpeechEngine } from './speech-engine.js';
import type { CDPSessionLike } from './types.js';

/**
 * Create a mock CDPSessionLike that returns the given nodes from getFullAXTree.
 */
function createMockCDP(
  nodes: Protocol.Accessibility.AXNode[] = []
): CDPSessionLike {
  return {
    send: vi.fn().mockImplementation((method: string) => {
      if (method === 'Accessibility.enable') return Promise.resolve();
      if (method === 'Accessibility.disable') return Promise.resolve();
      if (method === 'Accessibility.getFullAXTree') {
        return Promise.resolve({ nodes });
      }
      return Promise.resolve();
    }),
  };
}

/**
 * Create a minimal AXNode with common properties.
 */
function createNode(
  overrides: Partial<Protocol.Accessibility.AXNode> & {
    role: string;
    name?: string;
    focused?: boolean;
    properties?: Array<{ name: string; value: { type: string; value?: unknown } }>;
  }
): Protocol.Accessibility.AXNode {
  const node: Protocol.Accessibility.AXNode = {
    nodeId: overrides.nodeId ?? 'node-1',
    ignored: overrides.ignored ?? false,
    role: { type: 'role', value: overrides.role },
    ...(overrides.name !== undefined && {
      name: { type: 'computedString', value: overrides.name },
    }),
    ...(overrides.description !== undefined && {
      description: overrides.description,
    }),
    properties: overrides.properties ?? [],
  };

  // Add focused property if specified
  if (overrides.focused !== undefined) {
    node.properties = [
      ...(node.properties ?? []),
      { name: 'focused', value: { type: 'booleanOrUndefined', value: overrides.focused } },
    ];
  }

  return node;
}

describe('SpeechEngine', () => {
  let cdp: CDPSessionLike;
  let engine: SpeechEngine;

  describe('enable / disable', () => {
    beforeEach(() => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp);
    });

    it('calls Accessibility.enable on the CDP session', async () => {
      await engine.enable();
      expect(cdp.send).toHaveBeenCalledWith('Accessibility.enable');
    });

    it('calls Accessibility.disable on the CDP session', async () => {
      await engine.disable();
      expect(cdp.send).toHaveBeenCalledWith('Accessibility.disable');
    });
  });

  describe('computeSpeech', () => {
    beforeEach(() => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp);
    });

    it('produces "Products, button, collapsed" for a collapsed button', () => {
      const node = createNode({
        role: 'button',
        name: 'Products',
        properties: [
          { name: 'expanded', value: { type: 'booleanOrUndefined', value: false } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result).not.toBeNull();
      expect(result!.speech).toBe('Products, button, collapsed');
      expect(result!.name).toBe('Products');
      expect(result!.role).toBe('button');
      expect(result!.states).toEqual(['collapsed']);
    });

    it('produces "Products, button, expanded" for an expanded button', () => {
      const node = createNode({
        role: 'button',
        name: 'Products',
        properties: [
          { name: 'expanded', value: { type: 'booleanOrUndefined', value: true } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Products, button, expanded');
    });

    it('produces "Main, navigation landmark" for a nav element', () => {
      const node = createNode({
        role: 'navigation',
        name: 'Main',
      });
      const result = engine.computeSpeech(node);
      expect(result).not.toBeNull();
      expect(result!.speech).toBe('Main, navigation landmark');
      expect(result!.name).toBe('Main');
      expect(result!.role).toBe('navigation landmark');
      expect(result!.states).toEqual([]);
    });

    it('produces "Home, link" for a link element', () => {
      const node = createNode({
        role: 'link',
        name: 'Home',
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Home, link');
    });

    it('produces "Contact Us, link" for a link with spaces in name', () => {
      const node = createNode({
        role: 'link',
        name: 'Contact Us',
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Contact Us, link');
    });

    it('produces "Accept Terms, checkbox, checked" for a checked checkbox', () => {
      const node = createNode({
        role: 'checkbox',
        name: 'Accept Terms',
        properties: [
          { name: 'checked', value: { type: 'booleanOrUndefined', value: true } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Accept Terms, checkbox, checked');
    });

    it('produces "Accept Terms, checkbox, not checked" for unchecked checkbox', () => {
      const node = createNode({
        role: 'checkbox',
        name: 'Accept Terms',
        properties: [
          { name: 'checked', value: { type: 'booleanOrUndefined', value: false } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Accept Terms, checkbox, not checked');
    });

    it('produces "Welcome, heading, level 1" for an h1', () => {
      const node = createNode({
        role: 'heading',
        name: 'Welcome',
        properties: [
          { name: 'level', value: { type: 'integer', value: 1 } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Welcome, heading, level 1');
      expect(result!.states).toEqual(['level 1']);
    });

    it('produces "Search, heading, level 2" for an h2', () => {
      const node = createNode({
        role: 'heading',
        name: 'Search',
        properties: [
          { name: 'level', value: { type: 'integer', value: 2 } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Search, heading, level 2');
    });

    it('combines multiple states in correct order', () => {
      const node = createNode({
        role: 'textbox',
        name: 'Username',
        properties: [
          { name: 'required', value: { type: 'booleanOrUndefined', value: true } },
          { name: 'invalid', value: { type: 'booleanOrUndefined', value: true } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Username, edit text, required, invalid');
    });

    it('produces "Submit, button, dimmed" for a disabled button', () => {
      const node = createNode({
        role: 'button',
        name: 'Submit',
        properties: [
          { name: 'disabled', value: { type: 'booleanOrUndefined', value: true } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Submit, button, dimmed');
    });

    it('produces speech for element with only a role and no name', () => {
      const node = createNode({ role: 'separator' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('separator');
    });

    it('returns null for ignored nodes', () => {
      const node: Protocol.Accessibility.AXNode = {
        nodeId: 'n1',
        ignored: true,
        role: { type: 'role', value: 'button' },
        name: { type: 'computedString', value: 'Click' },
      };
      expect(engine.computeSpeech(node)).toBeNull();
    });

    it('returns null for nodes with no role', () => {
      const node: Protocol.Accessibility.AXNode = {
        nodeId: 'n1',
        ignored: false,
      };
      expect(engine.computeSpeech(node)).toBeNull();
    });

    it('returns null for generic nodes with no name', () => {
      const node = createNode({ role: 'generic' });
      expect(engine.computeSpeech(node)).toBeNull();
    });

    it('returns null for none/presentation roles with no name', () => {
      const node = createNode({ role: 'none' });
      expect(engine.computeSpeech(node)).toBeNull();
    });

    it('includes landmark suffix for all landmark roles', () => {
      const landmarkRoles = [
        'navigation', 'main', 'banner', 'contentinfo',
        'complementary', 'search', 'region', 'form',
      ];
      for (const role of landmarkRoles) {
        const node = createNode({ role, name: 'Test' });
        const result = engine.computeSpeech(node);
        expect(result!.speech).toContain('landmark');
      }
    });

    it('does not add landmark suffix to non-landmark roles', () => {
      const node = createNode({ role: 'button', name: 'Test' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).not.toContain('landmark');
    });

    it('preserves the raw AXNode in the result', () => {
      const node = createNode({ role: 'button', name: 'Click' });
      const result = engine.computeSpeech(node);
      expect(result!.rawNode).toBe(node);
    });

    it('handles menu item role correctly', () => {
      const node = createNode({ role: 'menuitem', name: 'Clothing' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Clothing, menu item');
    });

    it('handles dialog role with name', () => {
      const node = createNode({ role: 'dialog', name: 'Confirmation' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Confirmation, dialog');
    });

    it('handles list and list item roles', () => {
      const listNode = createNode({ role: 'list', name: 'Navigation' });
      const itemNode = createNode({ role: 'listitem', name: 'Item 1' });

      expect(engine.computeSpeech(listNode)!.speech).toBe('Navigation, list');
      expect(engine.computeSpeech(itemNode)!.speech).toBe('Item 1, list item');
    });

    it('handles image role with alt text', () => {
      const node = createNode({ role: 'img', name: 'Company Logo' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Company Logo, image');
    });

    it('handles switch role with pressed state', () => {
      const node = createNode({
        role: 'switch',
        name: 'Dark Mode',
        properties: [
          { name: 'pressed', value: { type: 'booleanOrUndefined', value: true } },
        ],
      });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Dark Mode, switch, pressed');
    });
  });

  describe('computeSpeech with options', () => {
    it('omits landmark suffix when includeLandmarks is false', () => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp, { includeLandmarks: false });

      const node = createNode({ role: 'navigation', name: 'Main' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Main, navigation');
    });

    it('includes description when includeDescription is true', () => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp, { includeDescription: true });

      const node: Protocol.Accessibility.AXNode = {
        nodeId: 'n1',
        ignored: false,
        role: { type: 'role', value: 'button' },
        name: { type: 'computedString', value: 'Delete' },
        description: { type: 'computedString', value: 'Removes the item permanently' },
        properties: [],
      };
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Delete, button, Removes the item permanently');
    });

    it('does not include description when includeDescription is false (default)', () => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp);

      const node: Protocol.Accessibility.AXNode = {
        nodeId: 'n1',
        ignored: false,
        role: { type: 'role', value: 'button' },
        name: { type: 'computedString', value: 'Delete' },
        description: { type: 'computedString', value: 'Removes the item permanently' },
        properties: [],
      };
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Delete, button');
    });
  });

  describe('findFocusedNode', () => {
    beforeEach(() => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp);
    });

    it('returns the node with focused=true', () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'button', name: 'A' }),
        createNode({ nodeId: 'n2', role: 'button', name: 'B', focused: true }),
        createNode({ nodeId: 'n3', role: 'button', name: 'C' }),
      ];
      const result = engine.findFocusedNode(nodes);
      expect(result).not.toBeNull();
      expect(result!.nodeId).toBe('n2');
    });

    it('returns null when no node is focused', () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'button', name: 'A' }),
        createNode({ nodeId: 'n2', role: 'button', name: 'B' }),
      ];
      expect(engine.findFocusedNode(nodes)).toBeNull();
    });

    it('returns null for an empty node list', () => {
      expect(engine.findFocusedNode([])).toBeNull();
    });

    it('returns the first focused node when multiple are focused', () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'button', name: 'A', focused: true }),
        createNode({ nodeId: 'n2', role: 'button', name: 'B', focused: true }),
      ];
      const result = engine.findFocusedNode(nodes);
      expect(result!.nodeId).toBe('n1');
    });

    it('ignores focused=false nodes', () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'button', name: 'A', focused: false }),
      ];
      expect(engine.findFocusedNode(nodes)).toBeNull();
    });
  });

  describe('getSpeech', () => {
    it('returns speech for the focused element', async () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'generic' }),
        createNode({
          nodeId: 'n2',
          role: 'button',
          name: 'Products',
          focused: true,
          properties: [
            { name: 'expanded', value: { type: 'booleanOrUndefined', value: false } },
          ],
        }),
      ];
      cdp = createMockCDP(nodes);
      engine = new SpeechEngine(cdp);

      const result = await engine.getSpeech();
      expect(result).not.toBeNull();
      expect(result!.speech).toBe('Products, button, collapsed');
    });

    it('returns null when no element is focused', async () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'button', name: 'Click' }),
      ];
      cdp = createMockCDP(nodes);
      engine = new SpeechEngine(cdp);

      const result = await engine.getSpeech();
      expect(result).toBeNull();
    });

    it('calls getFullAXTree on the CDP session', async () => {
      cdp = createMockCDP([]);
      engine = new SpeechEngine(cdp);

      await engine.getSpeech();
      expect(cdp.send).toHaveBeenCalledWith('Accessibility.getFullAXTree');
    });
  });

  describe('getFullTreeSpeech', () => {
    it('returns speech for all non-silent nodes', async () => {
      const nodes = [
        createNode({ nodeId: 'n1', role: 'RootWebArea', name: '' }),
        createNode({ nodeId: 'n2', role: 'navigation', name: 'Main' }),
        createNode({ nodeId: 'n3', role: 'button', name: 'Products' }),
        createNode({ nodeId: 'n4', role: 'generic' }),
        createNode({ nodeId: 'n5', role: 'link', name: 'Home' }),
      ];
      cdp = createMockCDP(nodes);
      engine = new SpeechEngine(cdp);

      const results = await engine.getFullTreeSpeech();
      const speeches = results.map((r) => r.speech);

      expect(speeches).toContain('Main, navigation landmark');
      expect(speeches).toContain('Products, button');
      expect(speeches).toContain('Home, link');
      // Should NOT contain entries for RootWebArea or generic
      expect(speeches).not.toContain('');
    });

    it('filters out ignored nodes', async () => {
      const nodes: Protocol.Accessibility.AXNode[] = [
        createNode({ nodeId: 'n1', role: 'button', name: 'Visible' }),
        {
          nodeId: 'n2',
          ignored: true,
          role: { type: 'role', value: 'button' },
          name: { type: 'computedString', value: 'Hidden' },
        },
      ];
      cdp = createMockCDP(nodes);
      engine = new SpeechEngine(cdp);

      const results = await engine.getFullTreeSpeech();
      expect(results).toHaveLength(1);
      expect(results[0].speech).toBe('Visible, button');
    });

    it('returns empty array for empty tree', async () => {
      cdp = createMockCDP([]);
      engine = new SpeechEngine(cdp);

      const results = await engine.getFullTreeSpeech();
      expect(results).toEqual([]);
    });
  });

  describe('forward compatibility', () => {
    beforeEach(() => {
      cdp = createMockCDP();
      engine = new SpeechEngine(cdp);
    });

    it('passes through unknown roles as-is', () => {
      const node = createNode({ role: 'futuristic-widget', name: 'Widget' });
      const result = engine.computeSpeech(node);
      expect(result!.speech).toBe('Widget, futuristic-widget');
      expect(result!.role).toBe('futuristic-widget');
    });
  });
});
