/**
 * @module role-map
 *
 * Maps Chrome DevTools Protocol AXTree role values to human-readable
 * speech role strings.
 *
 * CDP already maps HTML elements to their implicit ARIA roles (e.g.,
 * `<button>` → `"button"`, `<nav>` → `"navigation"`). This module
 * translates those internal role names to the strings that appear in
 * the final speech output.
 *
 * Unknown roles pass through as-is, ensuring forward compatibility
 * with new ARIA roles.
 */

/**
 * Maps CDP AXTree `role.value` strings to speech output role strings.
 *
 * Keys are the role values returned by `Accessibility.getFullAXTree()`.
 * Values are the corresponding human-readable strings used in speech
 * output.
 *
 * Roles that map to an empty string (`''`) are silent — they produce
 * no role announcement in the speech output.
 *
 * @example
 * ```typescript
 * ROLE_TO_SPEECH['button']     // → 'button'
 * ROLE_TO_SPEECH['navigation'] // → 'navigation'
 * ROLE_TO_SPEECH['generic']    // → '' (silent)
 * ```
 */
export const ROLE_TO_SPEECH: Record<string, string> = {
  // ─── Interactive widget roles ───
  button: 'button',
  link: 'link',
  checkbox: 'checkbox',
  radio: 'radio button',
  textbox: 'edit text',
  combobox: 'combo box',
  slider: 'slider',
  switch: 'switch',
  tab: 'tab',
  menuitem: 'menu item',
  menuitemcheckbox: 'menu item checkbox',
  menuitemradio: 'menu item radio',
  option: 'option',
  searchbox: 'search text',
  spinbutton: 'spin button',

  // ─── Landmark roles ───
  navigation: 'navigation',
  main: 'main',
  banner: 'banner',
  contentinfo: 'content info',
  complementary: 'complementary',
  search: 'search',
  region: 'region',
  form: 'form',

  // ─── Document structure roles ───
  heading: 'heading',
  list: 'list',
  listitem: 'list item',
  img: 'image',
  figure: 'figure',
  table: 'table',
  row: 'row',
  cell: 'cell',
  columnheader: 'column header',
  rowheader: 'row header',
  grid: 'grid',
  gridcell: 'grid cell',
  tree: 'tree',
  treeitem: 'tree item',
  tablist: 'tab list',
  tabpanel: 'tab panel',
  menu: 'menu',
  menubar: 'menu bar',
  toolbar: 'toolbar',
  dialog: 'dialog',
  alertdialog: 'alert dialog',
  alert: 'alert',
  status: 'status',
  progressbar: 'progress bar',
  separator: 'separator',
  group: 'group',
  article: 'article',
  definition: 'definition',
  term: 'term',
  note: 'note',
  log: 'log',
  marquee: 'marquee',
  timer: 'timer',
  tooltip: 'tooltip',
  feed: 'feed',
  math: 'math',
  directory: 'directory',
  document: 'document',
  application: 'application',

  // ─── Silent roles (no spoken role) ───
  generic: '',
  none: '',
  presentation: '',
  StaticText: '',
  InlineTextBox: '',
  LineBreak: '',
  RootWebArea: '',
  WebArea: '',
  paragraph: '',
  DescriptionListDetail: '',
  DescriptionListTerm: '',
  DescriptionList: '',
};

/**
 * Set of roles classified as "landmark" roles.
 *
 * When a node has a landmark role, the word `"landmark"` is appended
 * to its speech output. For example, a `<nav>` element produces
 * `"Main, navigation landmark"` rather than just `"Main, navigation"`.
 */
export const LANDMARK_ROLES = new Set<string>([
  'navigation',
  'main',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'region',
  'form',
]);
