/**
 * Coordinated z-index layers for the app.
 * Use these constants instead of ad-hoc z-index values to prevent overlap conflicts.
 */

export const Z_INDEX = {
  /** Standard content layer */
  CONTENT: 1,
  /** Dropdown menus, quick actions panels */
  DROPDOWN: 100,
  /** Tooltips and info popups */
  TOOLTIP: 200,
  /** Modal overlays */
  MODAL: 300,
  /** Toast notifications (above modals) */
  TOAST: 400,
  /** Loading spinners / full-screen overlays */
  LOADING: 500,
  /** Debug menus (always on top) */
  DEBUG: 999,
} as const;
