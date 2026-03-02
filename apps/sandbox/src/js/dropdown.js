/**
 * Dropdown Navigation Menubar
 *
 * Implements the WAI-ARIA Menubar pattern with full keyboard navigation.
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
 *
 * Keyboard behavior:
 *   Tab         — Enter/exit the menubar (focus first item on entry)
 *   Left/Right  — Move between top-level menubar items
 *   Enter/Space — Open submenu or activate link
 *   Down Arrow  — Open submenu or move to next submenu item
 *   Up Arrow    — Move to previous submenu item
 *   Escape      — Close submenu, return focus to parent trigger
 *   Home/End    — Move to first/last item in current context
 */
(function () {
  'use strict';

  const menubar = document.querySelector('[role="menubar"]');
  if (!menubar) return;

  /** All top-level menubar items (both links and buttons). */
  const topLevelItems = Array.from(
    menubar.querySelectorAll(':scope > li > [role="menuitem"]')
  );

  /** Map of trigger buttons to their submenu containers. */
  const submenuMap = new Map();

  topLevelItems.forEach((item) => {
    const submenu = item.parentElement.querySelector('[role="menu"]');
    if (submenu) {
      submenuMap.set(item, submenu);
    }
  });

  /**
   * Get all menuitem elements within a submenu.
   * @param {HTMLElement} submenu
   * @returns {HTMLElement[]}
   */
  function getSubmenuItems(submenu) {
    return Array.from(submenu.querySelectorAll('[role="menuitem"]'));
  }

  /**
   * Open a submenu and move focus to the first item.
   * @param {HTMLElement} trigger - The button that owns the submenu.
   * @param {boolean} [focusFirst=true] - Whether to focus the first submenu item.
   */
  function openSubmenu(trigger, focusFirst = true) {
    const submenu = submenuMap.get(trigger);
    if (!submenu) return;

    trigger.setAttribute('aria-expanded', 'true');
    submenu.setAttribute('data-open', 'true');

    if (focusFirst) {
      const items = getSubmenuItems(submenu);
      if (items.length > 0) {
        items[0].focus();
      }
    }
  }

  /**
   * Close a submenu and return focus to its trigger button.
   * @param {HTMLElement} trigger - The button that owns the submenu.
   * @param {boolean} [returnFocus=true] - Whether to return focus to the trigger.
   */
  function closeSubmenu(trigger, returnFocus = true) {
    const submenu = submenuMap.get(trigger);
    if (!submenu) return;

    trigger.setAttribute('aria-expanded', 'false');
    submenu.setAttribute('data-open', 'false');

    if (returnFocus) {
      trigger.focus();
    }
  }

  /**
   * Close all open submenus.
   * @param {HTMLElement} [exceptTrigger] - Optional trigger to keep open.
   */
  function closeAllSubmenus(exceptTrigger) {
    submenuMap.forEach((submenu, trigger) => {
      if (trigger !== exceptTrigger) {
        trigger.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('data-open', 'false');
      }
    });
  }

  /**
   * Find the trigger button that owns a given submenu item.
   * @param {HTMLElement} submenuItem
   * @returns {HTMLElement|null}
   */
  function findParentTrigger(submenuItem) {
    const submenu = submenuItem.closest('[role="menu"]');
    if (!submenu) return null;

    for (const [trigger, menu] of submenuMap) {
      if (menu === submenu) return trigger;
    }
    return null;
  }

  /**
   * Handle keydown on top-level menubar items.
   * @param {KeyboardEvent} event
   */
  function handleMenubarKeydown(event) {
    const currentItem = event.target;
    const currentIndex = topLevelItems.indexOf(currentItem);
    if (currentIndex === -1) return;

    let handled = false;

    switch (event.key) {
      case 'ArrowRight': {
        const nextIndex = (currentIndex + 1) % topLevelItems.length;
        closeAllSubmenus();
        topLevelItems[nextIndex].focus();
        handled = true;
        break;
      }

      case 'ArrowLeft': {
        const prevIndex =
          (currentIndex - 1 + topLevelItems.length) % topLevelItems.length;
        closeAllSubmenus();
        topLevelItems[prevIndex].focus();
        handled = true;
        break;
      }

      case 'ArrowDown': {
        if (submenuMap.has(currentItem)) {
          openSubmenu(currentItem);
          handled = true;
        }
        break;
      }

      case 'Enter':
      case ' ': {
        if (submenuMap.has(currentItem)) {
          // It's a trigger button — toggle submenu
          const isExpanded =
            currentItem.getAttribute('aria-expanded') === 'true';
          if (isExpanded) {
            closeSubmenu(currentItem);
          } else {
            closeAllSubmenus();
            openSubmenu(currentItem);
          }
          handled = true;
        }
        // For links, let the default behavior happen (navigation)
        break;
      }

      case 'Home': {
        closeAllSubmenus();
        topLevelItems[0].focus();
        handled = true;
        break;
      }

      case 'End': {
        closeAllSubmenus();
        topLevelItems[topLevelItems.length - 1].focus();
        handled = true;
        break;
      }

      case 'Escape': {
        closeAllSubmenus();
        // Move focus out of the menubar
        currentItem.blur();
        handled = true;
        break;
      }
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handle keydown on submenu items.
   * @param {KeyboardEvent} event
   */
  function handleSubmenuKeydown(event) {
    const currentItem = event.target;
    const trigger = findParentTrigger(currentItem);
    if (!trigger) return;

    const submenu = submenuMap.get(trigger);
    if (!submenu) return;

    const items = getSubmenuItems(submenu);
    const currentIndex = items.indexOf(currentItem);
    if (currentIndex === -1) return;

    let handled = false;

    switch (event.key) {
      case 'ArrowDown': {
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].focus();
        handled = true;
        break;
      }

      case 'ArrowUp': {
        const prevIndex =
          (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].focus();
        handled = true;
        break;
      }

      case 'ArrowRight': {
        // Move to next top-level item and open its submenu (if it has one)
        const triggerIndex = topLevelItems.indexOf(trigger);
        const nextTopIndex = (triggerIndex + 1) % topLevelItems.length;
        closeAllSubmenus();
        topLevelItems[nextTopIndex].focus();
        if (submenuMap.has(topLevelItems[nextTopIndex])) {
          openSubmenu(topLevelItems[nextTopIndex]);
        }
        handled = true;
        break;
      }

      case 'ArrowLeft': {
        // Move to previous top-level item and open its submenu (if it has one)
        const triggerIdx = topLevelItems.indexOf(trigger);
        const prevTopIndex =
          (triggerIdx - 1 + topLevelItems.length) % topLevelItems.length;
        closeAllSubmenus();
        topLevelItems[prevTopIndex].focus();
        if (submenuMap.has(topLevelItems[prevTopIndex])) {
          openSubmenu(topLevelItems[prevTopIndex]);
        }
        handled = true;
        break;
      }

      case 'Escape': {
        closeSubmenu(trigger, true);
        handled = true;
        break;
      }

      case 'Home': {
        items[0].focus();
        handled = true;
        break;
      }

      case 'End': {
        items[items.length - 1].focus();
        handled = true;
        break;
      }

      case 'Enter':
      case ' ': {
        // Activate the link — let default behavior happen for links
        if (currentItem.tagName === 'A') {
          // Default behavior navigates; we don't prevent it
        }
        break;
      }
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Attach keydown listeners to all top-level items
  topLevelItems.forEach((item) => {
    item.addEventListener('keydown', handleMenubarKeydown);
  });

  // Attach keydown listeners to all submenu items
  submenuMap.forEach((submenu) => {
    const items = getSubmenuItems(submenu);
    items.forEach((item) => {
      item.addEventListener('keydown', handleSubmenuKeydown);
    });
  });

  // Close submenus when clicking outside the menubar
  document.addEventListener('click', (event) => {
    if (!menubar.contains(event.target)) {
      closeAllSubmenus();
    }
  });

  // Handle click on trigger buttons
  submenuMap.forEach((_submenu, trigger) => {
    trigger.addEventListener('click', () => {
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      closeAllSubmenus();
      if (!isExpanded) {
        openSubmenu(trigger, true);
      }
    });
  });
})();
