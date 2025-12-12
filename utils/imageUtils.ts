import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

// Maximum image size in bytes (500KB for profile/post images)
const MAX_IMAGE_SIZE = 500 * 1024;

// Image quality for compression (0-1)
const IMAGE_QUALITY = 0.7;

// Maximum dimensions for resizing
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;

export interface ImagePickerResult {
  success: boolean;
  uri?: string;
  base64?: string;
  error?: string;
}

/**
 * Request permission to access the photo library
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true; // Web doesn't need permissions
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please allow access to your photo library to upload images.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  return true;
}

/**
 * Request permission to access the camera
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please allow access to your camera to take photos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  return true;
}

/**
 * Pick an image from the device gallery
 */
export async function pickImageFromGallery(
  options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }
): Promise<ImagePickerResult> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [1, 1],
      quality: options?.quality ?? IMAGE_QUALITY,
      base64: true,
      exif: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'Image selection cancelled' };
    }

    const asset = result.assets[0];
    
    // Check if the image is too large
    if (asset.base64) {
      const base64Size = (asset.base64.length * 3) / 4;
      if (base64Size > MAX_IMAGE_SIZE * 2) {
        // Image is very large, warn user
        Alert.alert(
          'Large Image',
          'The selected image is quite large. It may take longer to save.',
          [{ text: 'OK' }]
        );
      }
    }

    return {
      success: true,
      uri: asset.uri,
      base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
    };
  } catch (error: any) {
    console.error('Error picking image:', error);
    return { success: false, error: error.message || 'Failed to pick image' };
  }
}

/**
 * Pick a profile photo (square, 1:1 aspect ratio)
 */
export async function pickProfilePhoto(): Promise<ImagePickerResult> {
  return pickImageFromGallery({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
}

/**
 * Pick a header/cover photo (wide, 3:1 aspect ratio)
 */
export async function pickHeaderPhoto(): Promise<ImagePickerResult> {
  return pickImageFromGallery({
    allowsEditing: true,
    aspect: [3, 1],
    quality: 0.7,
  });
}

/**
 * Pick a photo for a post (flexible aspect ratio)
 */
export async function pickPostPhoto(): Promise<ImagePickerResult> {
  return pickImageFromGallery({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(
  options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }
): Promise<ImagePickerResult> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [1, 1],
      quality: options?.quality ?? IMAGE_QUALITY,
      base64: true,
      exif: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'Photo capture cancelled' };
    }

    const asset = result.assets[0];

    return {
      success: true,
      uri: asset.uri,
      base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
    };
  } catch (error: any) {
    console.error('Error taking photo:', error);
    return { success: false, error: error.message || 'Failed to take photo' };
  }
}

/**
 * Show image source picker (gallery or camera)
 */
export function showImageSourcePicker(
  onGallery: () => void,
  onCamera: () => void,
  onCancel?: () => void
): void {
  Alert.alert(
    'Select Image',
    'Choose where to get your image from',
    [
      { text: 'Photo Library', onPress: onGallery },
      { text: 'Camera', onPress: onCamera },
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
    ],
    { cancelable: true }
  );
}

/**
 * Validate if a string is a valid base64 image
 */
export function isValidBase64Image(str: string): boolean {
  if (!str) return false;
  return str.startsWith('data:image/') && str.includes('base64,');
}

/**
 * Get estimated size of base64 string in KB
 */
export function getBase64SizeKB(base64: string): number {
  if (!base64) return 0;
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  // Estimate size: base64 is ~4/3 the size of binary
  return Math.round((base64Data.length * 3) / 4 / 1024);
}

/**
 * Default placeholder images
 */
export const PLACEHOLDER_IMAGES = {
  profile: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200&h=200&fit=crop&crop=face',
  header: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=267&fit=crop',
  post: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
};

