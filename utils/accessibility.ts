/**
 * Accessibility utilities and helpers
 */

export interface AccessibilityProps {
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'text' | 'image' | 'header' | 'link' | 'search' | 'keyboardkey' | 'textbox' | 'summary' | 'adjustable' | 'alert' | 'checkbox' | 'combobox' | 'menu' | 'menubar' | 'menuitem' | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar' | 'spinbutton' | 'switch' | 'tab' | 'tablist' | 'timer' | 'toolbar';
  accessibilityHint?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
  accessibilityValue?: {
    min?: number;
    max?: number;
    now?: number;
    text?: string;
  };
}

/**
 * Generate accessibility props for common UI elements
 */
export function getAccessibilityProps(type: 'button' | 'text' | 'image' | 'input', options: {
  label: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
  value?: string | number;
  min?: number;
  max?: number;
}): AccessibilityProps {
  const baseProps: AccessibilityProps = {
    accessibilityLabel: options.label || '',
    accessibilityRole: type || 'button',
  };

  if (options.hint) {
    baseProps.accessibilityHint = options.hint;
  }

  if (options.disabled !== undefined || options.selected !== undefined) {
    baseProps.accessibilityState = {
      disabled: options.disabled || false,
      selected: options.selected || false,
    };
  }

  if (type === 'input' && (options.value !== undefined || options.min !== undefined || options.max !== undefined)) {
    baseProps.accessibilityValue = {
      text: options.value?.toString(),
      min: options.min,
      max: options.max,
    };
  }

  return baseProps;
}

/**
 * Generate accessibility props for buttons with loading states
 */
export function getButtonAccessibilityProps(options: {
  label: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
}): AccessibilityProps {
  const label = options.loading ? `${options.label} - Loading` : options.label;
  
  const props = getAccessibilityProps('button', {
    label,
    hint: options.hint,
    disabled: options.disabled || options.loading,
    selected: options.pressed,
  });

  // Ensure all properties exist to avoid undefined issues
  return {
    accessibilityLabel: props.accessibilityLabel || options.label,
    accessibilityRole: props.accessibilityRole || 'button',
    accessibilityHint: props.accessibilityHint,
    accessibilityState: props.accessibilityState,
    accessibilityValue: props.accessibilityValue,
  };
}

/**
 * Generate accessibility props for form inputs
 */
export function getInputAccessibilityProps(options: {
  label: string;
  hint?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}): AccessibilityProps {
  const label = options.required ? `${options.label} (required)` : options.label;
  const hint = [
    options.hint,
    options.placeholder && `Placeholder: ${options.placeholder}`,
    options.maxLength && `Maximum ${options.maxLength} characters`,
  ].filter(Boolean).join('. ');

  return getAccessibilityProps('input', {
    label,
    hint,
    disabled: options.disabled,
    value: options.value,
    max: options.maxLength,
  });
}

/**
 * Generate accessibility props for images
 */
export function getImageAccessibilityProps(options: {
  label: string;
  hint?: string;
  decorative?: boolean;
}): AccessibilityProps {
  return {
    accessibilityLabel: options.decorative ? undefined : options.label,
    accessibilityRole: options.decorative ? undefined : 'image',
    accessibilityHint: options.hint,
  };
}

/**
 * Generate accessibility props for progress indicators
 */
export function getProgressAccessibilityProps(options: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}): AccessibilityProps {
  const percentage = Math.round((options.value / options.max) * 100);
  
  return {
    accessibilityLabel: options.label,
    accessibilityRole: 'progressbar',
    accessibilityHint: options.hint,
    accessibilityValue: {
      min: 0,
      max: options.max,
      now: options.value,
      text: `${percentage}%`,
    },
  };
}

/**
 * Common accessibility hints for the game
 */
export const ACCESSIBILITY_HINTS = {
  BUTTONS: {
    BUY: 'Tap to purchase this item',
    SELL: 'Tap to sell this item',
    WORK: 'Tap to perform this job',
    NEXT_WEEK: 'Tap to advance to the next week',
    SETTINGS: 'Tap to open game settings',
    HELP: 'Tap to get help and information',
    CONFIRM: 'Tap to confirm this action',
    CANCEL: 'Tap to cancel this action',
  },
  NAVIGATION: {
    BACK: 'Tap to go back to the previous screen',
    HOME: 'Tap to return to the main menu',
    TABS: 'Tap to switch between different sections',
  },
  GAME_ELEMENTS: {
    MONEY: 'Your current money balance',
    HEALTH: 'Your current health level',
    ENERGY: 'Your current energy level',
    HAPPINESS: 'Your current happiness level',
    AGE: 'Your current age',
    WEEK: 'Current week in the game',
  },
  FORMS: {
    REQUIRED: 'This field is required',
    OPTIONAL: 'This field is optional',
    NUMERIC: 'Enter a number',
    EMAIL: 'Enter an email address',
    PASSWORD: 'Enter a password',
  },
} as const;
