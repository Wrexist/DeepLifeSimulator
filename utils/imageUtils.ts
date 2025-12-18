// STUB: expo-image-picker removed to fix TurboModule crash
// All image picking functions return disabled/error state
import { Alert, Platform } from 'react-native';

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
