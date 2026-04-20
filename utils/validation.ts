/**
 * Input Validation Utilities
 * 
 * Provides validation functions for user inputs with proper error handling
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: number | string;
}

/**
 * Validate money amount input
 * @param amount - String or number to validate
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (optional)
 * @returns ValidationResult with valid flag, error message, and parsed value
 */
export const validateMoney = (
  amount: string | number,
  min: number = 0,
  max?: number
): ValidationResult => {
  // Convert to number if string
  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Check if NaN
  if (isNaN(numValue)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }

  // Check if finite
  if (!isFinite(numValue)) {
    return { valid: false, error: 'Number is too large or invalid.' };
  }

  // Check minimum
  if (numValue < min) {
    return { valid: false, error: `Amount must be at least $${min.toLocaleString()}.` };
  }

  // Check maximum
  if (max !== undefined && numValue > max) {
    return { valid: false, error: `Amount cannot exceed $${max.toLocaleString()}.` };
  }

  // Check if negative (for money, should be positive unless explicitly allowed)
  if (numValue < 0 && min >= 0) {
    return { valid: false, error: 'Amount cannot be negative.' };
  }

  return { valid: true, value: numValue };
};

/**
 * Validate positive number input
 * @param value - String to validate
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (optional)
 * @returns ValidationResult with valid flag, error message, and parsed value
 */
export const validatePositiveNumber = (
  value: string,
  min?: number,
  max?: number
): ValidationResult => {
  const numValue = parseFloat(value);

  if (isNaN(numValue)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }

  if (!isFinite(numValue)) {
    return { valid: false, error: 'Number is too large or invalid.' };
  }

  if (numValue < 0) {
    return { valid: false, error: 'Number must be positive.' };
  }

  if (min !== undefined && numValue < min) {
    return { valid: false, error: `Value must be at least ${min}.` };
  }

  if (max !== undefined && numValue > max) {
    return { valid: false, error: `Value cannot exceed ${max}.` };
  }

  return { valid: true, value: numValue };
};

/**
 * Validate text input
 * @param text - String to validate
 * @param minLength - Minimum length (optional)
 * @param maxLength - Maximum length (optional)
 * @returns ValidationResult with valid flag and error message
 */
export const validateText = (
  text: string,
  minLength?: number,
  maxLength?: number
): ValidationResult => {
  if (minLength !== undefined && text.length < minLength) {
    return { valid: false, error: `Text must be at least ${minLength} characters.` };
  }

  if (maxLength !== undefined && text.length > maxLength) {
    return { valid: false, error: `Text cannot exceed ${maxLength} characters.` };
  }

  return { valid: true, value: text };
};

/**
 * Validate email address
 * @param email - Email string to validate
 * @returns ValidationResult with valid flag and error message
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required.' };
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return { valid: true, value: email };
};

/**
 * Validate percentage value (0-100)
 * @param value - String to validate
 * @returns ValidationResult with valid flag, error message, and parsed value
 */
export const validatePercentage = (value: string): ValidationResult => {
  const numValue = parseFloat(value);

  if (isNaN(numValue)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }

  if (!isFinite(numValue)) {
    return { valid: false, error: 'Number is too large or invalid.' };
  }

  if (numValue < 0 || numValue > 100) {
    return { valid: false, error: 'Percentage must be between 0 and 100.' };
  }

  return { valid: true, value: numValue };
};

/**
 * Validate integer input
 * @param value - String to validate
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @returns ValidationResult with valid flag, error message, and parsed integer value
 */
export const validateInteger = (
  value: string,
  min?: number,
  max?: number
): ValidationResult => {
  const numValue = parseInt(value, 10);

  if (isNaN(numValue)) {
    return { valid: false, error: 'Please enter a valid whole number.' };
  }

  if (!isFinite(numValue)) {
    return { valid: false, error: 'Number is too large or invalid.' };
  }

  // Check if it's actually an integer (no decimal part)
  if (parseFloat(value) !== numValue) {
    return { valid: false, error: 'Please enter a whole number (no decimals).' };
  }

  if (min !== undefined && numValue < min) {
    return { valid: false, error: `Value must be at least ${min}.` };
  }

  if (max !== undefined && numValue > max) {
    return { valid: false, error: `Value cannot exceed ${max}.` };
  }

  return { valid: true, value: numValue };
};

/**
 * Validate that a value is within a specific range
 * @param value - Number to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns ValidationResult with valid flag and error message
 */
export const validateRange = (
  value: number,
  min: number,
  max: number
): ValidationResult => {
  if (isNaN(value) || !isFinite(value)) {
    return { valid: false, error: 'Value must be a valid number.' };
  }

  if (value < min || value > max) {
    return { valid: false, error: `Value must be between ${min} and ${max}.` };
  }

  return { valid: true, value };
};

