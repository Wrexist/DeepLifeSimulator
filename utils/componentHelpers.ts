/**
 * Component Helper Utilities
 * 
 * Provides defensive programming helpers for component props validation,
 * particularly for LinearGradient and other components that require
 * specific prop formats.
 */

import React from 'react';

/**
 * Validates and returns a safe color array for LinearGradient components
 * 
 * @param colors - Optional color array that may be undefined or invalid
 * @param defaultColor - Default color to use if colors is invalid (default: 'transparent')
 * @returns A valid color array with at least one color
 * 
 * @example
 * ```tsx
 * <LinearGradient colors={safeColors(props.colors)} />
 * ```
 */
export function safeColors(
  colors?: string[] | readonly string[],
  defaultColor: string = 'transparent'
): string[] {
  // If colors is a valid array with at least one element, return it as a mutable array
  if (Array.isArray(colors) && colors.length > 0) {
    // Ensure all elements are strings
    const validColors = colors.filter((color): color is string => typeof color === 'string');
    if (validColors.length > 0) {
      return validColors;
    }
  }
  
  // Return default color array if input is invalid
  return [defaultColor];
}

/**
 * Validates LinearGradient props and returns safe defaults
 * 
 * @param props - LinearGradient props that may have invalid values
 * @returns Validated props with safe defaults
 * 
 * @example
 * ```tsx
 * const safeProps = safeLinearGradientProps({ colors: props.colors, style: props.style });
 * <LinearGradient {...safeProps} />
 * ```
 */
export function safeLinearGradientProps(props: {
  colors?: string[] | readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  style?: any;
  [key: string]: any;
}): {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  style?: any;
  [key: string]: any;
} {
  return {
    ...props,
    colors: safeColors(props.colors),
    // Validate start/end coordinates if provided
    start: props.start && typeof props.start.x === 'number' && typeof props.start.y === 'number'
      ? props.start
      : undefined,
    end: props.end && typeof props.end.x === 'number' && typeof props.end.y === 'number'
      ? props.end
      : undefined,
    // Validate locations array if provided
    locations: Array.isArray(props.locations) && props.locations.every(loc => typeof loc === 'number')
      ? props.locations
      : undefined,
  };
}

/**
 * Type guard to check if a value is a valid color array
 * 
 * @param value - Value to check
 * @returns True if value is a valid color array
 */
export function isValidColorArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(color => typeof color === 'string');
}

/**
 * Validates that a value is a valid React component
 * Checks for function components, class components, and forward refs
 * Rejects JSX elements (already rendered components)
 * 
 * @param value - Value to check
 * @returns True if value is a valid React component
 */
export function isValidReactComponent(value: any): value is React.ComponentType<any> {
  // Reject JSX elements (already rendered) - these are not component functions
  if (React.isValidElement(value)) {
    return false;
  }
  
  // Must be a function
  if (typeof value !== 'function') {
    return false;
  }
  
  // Function component (no prototype or prototype.render)
  if (!value.prototype || !value.prototype.render) {
    return true;
  }
  
  // Class component (has render method)
  if (typeof value.prototype.render === 'function') {
    return true;
  }
  
  // Forward ref component (has $$typeof)
  if (value.$$typeof === Symbol.for('react.forward_ref')) {
    return true;
  }
  
  // Memo component (has $$typeof)
  if (value.$$typeof === Symbol.for('react.memo')) {
    return true;
  }
  
  return false;
}

/**
 * Creates a safe wrapper component that catches render errors
 * Falls back to fallback component if render fails
 * 
 * @param Component - The component to wrap
 * @param FallbackComponent - The fallback component to use on error
 * @returns A safe wrapper component
 */
export function createSafeComponentWrapper<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  FallbackComponent: React.ComponentType<T>
): React.ComponentType<T> {
  const Wrapped = React.memo((props: T) => {
    try {
      return React.createElement(Component, props);
    } catch (error) {
      if (__DEV__) {
        console.warn('[SafeComponentWrapper] Render error, using fallback:', error);
      }
      return React.createElement(FallbackComponent, props);
    }
  });
  const componentLabel =
    Component.displayName || Component.name || 'Component';
  const fallbackLabel =
    FallbackComponent.displayName || FallbackComponent.name || 'Fallback';
  Wrapped.displayName = `SafeComponentWrapper(${componentLabel},${fallbackLabel})`;
  return Wrapped;
}

