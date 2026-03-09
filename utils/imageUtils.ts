// STUB: expo-image-picker removed to fix TurboModule crash
// All image picking functions return disabled/error state
import { Alert } from 'react-native';

export interface ImagePickerResult {
  success: boolean;
  uri?: string;
  base64?: string;
  error?: string;
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (__DEV__) {
    Alert.alert('Feature Disabled', 'Image picking temporarily disabled due to TurboModule crash fix.');
  }
  return false;
}

export async function requestCameraPermission(): Promise<boolean> {
  if (__DEV__) {
    Alert.alert('Feature Disabled', 'Camera temporarily disabled due to TurboModule crash fix.');
  }
  return false;
}

export async function pickImage(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Image picking temporarily disabled'
  };
}

export async function takePhoto(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Camera temporarily disabled'
  };
}

export async function pickImageFromLibrary(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Image picking temporarily disabled'
  };
}

export async function capturePhoto(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Camera temporarily disabled'
  };
}

export async function pickPostPhoto(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Image picking temporarily disabled'
  };
}

export async function pickProfilePhoto(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Image picking temporarily disabled'
  };
}

export async function pickHeaderPhoto(): Promise<ImagePickerResult> {
  return {
    success: false,
    error: 'Image picking temporarily disabled'
  };
}

export async function showImageSourcePicker(callback: () => Promise<void>): Promise<void> {
  if (__DEV__) {
    Alert.alert('Feature Disabled', 'Image source picker temporarily disabled due to TurboModule crash fix.');
  }
  // Call callback anyway to prevent UI from breaking
  try {
    await callback();
  } catch (error) {
    // Ignore errors
  }
}

// Local placeholder images (via.placeholder.com is defunct)
export const PLACEHOLDER_IMAGES = {
  profile: '', // Empty string triggers fallback UI in components
  header: '',  // Empty string triggers fallback UI in components
};