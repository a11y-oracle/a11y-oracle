import { describe, it, expect } from 'vitest';
import { ROLE_TO_SPEECH, LANDMARK_ROLES } from './role-map.js';

describe('ROLE_TO_SPEECH', () => {
  describe('interactive widget roles', () => {
    it.each([
      ['button', 'button'],
      ['link', 'link'],
      ['checkbox', 'checkbox'],
      ['radio', 'radio button'],
      ['textbox', 'edit text'],
      ['combobox', 'combo box'],
      ['slider', 'slider'],
      ['switch', 'switch'],
      ['tab', 'tab'],
      ['menuitem', 'menu item'],
      ['menuitemcheckbox', 'menu item checkbox'],
      ['menuitemradio', 'menu item radio'],
      ['option', 'option'],
      ['searchbox', 'search text'],
      ['spinbutton', 'spin button'],
    ])('maps "%s" to "%s"', (role, expected) => {
      expect(ROLE_TO_SPEECH[role]).toBe(expected);
    });
  });

  describe('landmark roles', () => {
    it.each([
      ['navigation', 'navigation'],
      ['main', 'main'],
      ['banner', 'banner'],
      ['contentinfo', 'content info'],
      ['complementary', 'complementary'],
      ['search', 'search'],
      ['region', 'region'],
      ['form', 'form'],
    ])('maps "%s" to "%s"', (role, expected) => {
      expect(ROLE_TO_SPEECH[role]).toBe(expected);
    });
  });

  describe('document structure roles', () => {
    it.each([
      ['heading', 'heading'],
      ['list', 'list'],
      ['listitem', 'list item'],
      ['img', 'image'],
      ['table', 'table'],
      ['dialog', 'dialog'],
      ['alert', 'alert'],
      ['menu', 'menu'],
      ['menubar', 'menu bar'],
      ['toolbar', 'toolbar'],
      ['tablist', 'tab list'],
      ['tabpanel', 'tab panel'],
      ['tree', 'tree'],
      ['treeitem', 'tree item'],
      ['progressbar', 'progress bar'],
      ['status', 'status'],
      ['group', 'group'],
    ])('maps "%s" to "%s"', (role, expected) => {
      expect(ROLE_TO_SPEECH[role]).toBe(expected);
    });
  });

  describe('silent roles', () => {
    it.each([
      'generic',
      'none',
      'presentation',
      'StaticText',
      'InlineTextBox',
      'LineBreak',
      'RootWebArea',
      'WebArea',
      'paragraph',
    ])('maps "%s" to empty string', (role) => {
      expect(ROLE_TO_SPEECH[role]).toBe('');
    });
  });
});

describe('LANDMARK_ROLES', () => {
  it('contains all landmark role names', () => {
    expect(LANDMARK_ROLES.has('navigation')).toBe(true);
    expect(LANDMARK_ROLES.has('main')).toBe(true);
    expect(LANDMARK_ROLES.has('banner')).toBe(true);
    expect(LANDMARK_ROLES.has('contentinfo')).toBe(true);
    expect(LANDMARK_ROLES.has('complementary')).toBe(true);
    expect(LANDMARK_ROLES.has('search')).toBe(true);
    expect(LANDMARK_ROLES.has('region')).toBe(true);
    expect(LANDMARK_ROLES.has('form')).toBe(true);
  });

  it('does not contain non-landmark roles', () => {
    expect(LANDMARK_ROLES.has('button')).toBe(false);
    expect(LANDMARK_ROLES.has('link')).toBe(false);
    expect(LANDMARK_ROLES.has('heading')).toBe(false);
    expect(LANDMARK_ROLES.has('generic')).toBe(false);
  });

  it('all landmark roles have entries in ROLE_TO_SPEECH', () => {
    for (const role of LANDMARK_ROLES) {
      expect(role in ROLE_TO_SPEECH).toBe(true);
      expect(ROLE_TO_SPEECH[role]).not.toBe('');
    }
  });
});
