/**
 * Profile Edit Modal - X.com Style
 * 
 * Modal for editing profile details including photo uploads
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Camera,
  ArrowLeft,
} from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { 
  pickProfilePhoto, 
  pickHeaderPhoto, 
  showImageSourcePicker,
  takePhoto,
  PLACEHOLDER_IMAGES 
} from '@/utils/imageUtils';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (profile: ProfileData) => void;
  initialData: ProfileData;
}

export interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  location?: string;
  website?: string;
  profilePhoto?: string;
  headerPhoto?: string;
}

const MAX_NAME_LENGTH = 50;
const MAX_BIO_LENGTH = 160;
const MAX_LOCATION_LENGTH = 30;
const MAX_WEBSITE_LENGTH = 100;

export default function ProfileEditModal({
  visible,
  onClose,
  onSave,
  initialData,
}: ProfileEditModalProps) {
  const [displayName, setDisplayName] = useState(initialData.displayName);
  const [bio, setBio] = useState(initialData.bio);
  const [location, setLocation] = useState(initialData.location || '');
  const [website, setWebsite] = useState(initialData.website || '');
  const [profilePhoto, setProfilePhoto] = useState(initialData.profilePhoto);
  const [headerPhoto, setHeaderPhoto] = useState(initialData.headerPhoto);
  const [isSaving, setIsSaving] = useState(false);
  
  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setDisplayName(initialData.displayName);
      setBio(initialData.bio);
      setLocation(initialData.location || '');
      setWebsite(initialData.website || '');
      setProfilePhoto(initialData.profilePhoto);
      setHeaderPhoto(initialData.headerPhoto);
    }
  }, [visible, initialData]);
  
  const hasChanges = useCallback(() => {
    return (
      displayName !== initialData.displayName ||
      bio !== initialData.bio ||
      location !== (initialData.location || '') ||
      website !== (initialData.website || '') ||
      profilePhoto !== initialData.profilePhoto ||
      headerPhoto !== initialData.headerPhoto
    );
  }, [displayName, bio, location, website, profilePhoto, headerPhoto, initialData]);
  
  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave({
        displayName: displayName.trim(),
        username: initialData.username, // Username not editable
        bio: bio.trim(),
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        profilePhoto,
        headerPhoto,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [displayName, bio, location, website, profilePhoto, headerPhoto, initialData.username, onSave, onClose]);
  
  const handleClose = useCallback(() => {
    if (hasChanges()) {
      Alert.alert(
        'Discard changes?',
        'Your changes will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: onClose
          },
        ]
      );
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);
  
  const handlePickProfilePhoto = useCallback(() => {
    showImageSourcePicker(
      async () => {
        const result = await pickProfilePhoto();
        if (result.success && result.base64) {
          setProfilePhoto(result.base64);
        }
      },
      async () => {
        const result = await takePhoto({ aspect: [1, 1] });
        if (result.success && result.base64) {
          setProfilePhoto(result.base64);
        }
      }
    );
  }, []);
  
  const handlePickHeaderPhoto = useCallback(() => {
    showImageSourcePicker(
      async () => {
        const result = await pickHeaderPhoto();
        if (result.success && result.base64) {
          setHeaderPhoto(result.base64);
        }
      },
      async () => {
        const result = await takePhoto({ aspect: [3, 1] });
        if (result.success && result.base64) {
          setHeaderPhoto(result.base64);
        }
      }
    );
  }, []);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleClose}
          >
            <ArrowLeft size={scale(24)} color="#E7E9EA" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Edit profile</Text>
          
          <TouchableOpacity
            style={[
              styles.saveButton,
              !hasChanges() && styles.saveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={!hasChanges() || isSaving}
          >
            <Text style={[
              styles.saveButtonText,
              !hasChanges() && styles.saveButtonTextDisabled
            ]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Photo */}
          <TouchableOpacity 
            style={styles.headerPhotoContainer}
            onPress={handlePickHeaderPhoto}
          >
            <ImageBackground
              source={{ uri: headerPhoto || PLACEHOLDER_IMAGES.header }}
              style={styles.headerPhoto}
              resizeMode="cover"
            >
              <View style={styles.photoOverlay}>
                <View style={styles.cameraButton}>
                  <Camera size={scale(24)} color="#FFFFFF" />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
          
          {/* Profile Photo */}
          <View style={styles.profilePhotoSection}>
            <TouchableOpacity 
              style={styles.profilePhotoContainer}
              onPress={handlePickProfilePhoto}
            >
              <Image
                source={{ uri: profilePhoto || PLACEHOLDER_IMAGES.profile }}
                style={styles.profilePhoto}
              />
              <View style={styles.profilePhotoOverlay}>
                <Camera size={scale(20)} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Form Fields */}
          <View style={styles.form}>
            {/* Display Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#71767B"
                maxLength={MAX_NAME_LENGTH}
              />
              <Text style={styles.characterCount}>
                {displayName.length}/{MAX_NAME_LENGTH}
              </Text>
            </View>
            
            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell the world about yourself"
                placeholderTextColor="#71767B"
                maxLength={MAX_BIO_LENGTH}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.characterCount}>
                {bio.length}/{MAX_BIO_LENGTH}
              </Text>
            </View>
            
            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Your location"
                placeholderTextColor="#71767B"
                maxLength={MAX_LOCATION_LENGTH}
              />
            </View>
            
            {/* Website */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Website</Text>
              <TextInput
                style={styles.input}
                value={website}
                onChangeText={setWebsite}
                placeholder="yourwebsite.com"
                placeholderTextColor="#71767B"
                maxLength={MAX_WEBSITE_LENGTH}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  closeButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  saveButton: {
    backgroundColor: '#E7E9EA',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(231, 233, 234, 0.5)',
  },
  saveButtonText: {
    color: '#000000',
    fontSize: fontScale(14),
    fontWeight: 'bold',
  },
  saveButtonTextDisabled: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  scrollView: {
    flex: 1,
  },
  headerPhotoContainer: {
    width: '100%',
  },
  headerPhoto: {
    height: scale(120),
    width: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoSection: {
    paddingHorizontal: scale(16),
    marginTop: scale(-40),
  },
  profilePhotoContainer: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    position: 'relative',
  },
  profilePhoto: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    borderWidth: 4,
    borderColor: '#000000',
    backgroundColor: '#1F2937',
  },
  profilePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    padding: scale(16),
    paddingTop: scale(24),
  },
  inputGroup: {
    marginBottom: scale(20),
  },
  inputLabel: {
    fontSize: fontScale(13),
    color: '#71767B',
    marginBottom: scale(8),
  },
  input: {
    fontSize: fontScale(16),
    color: '#E7E9EA',
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
    paddingVertical: scale(8),
  },
  inputMultiline: {
    minHeight: scale(80),
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: fontScale(12),
    color: '#71767B',
    textAlign: 'right',
    marginTop: scale(4),
  },
});

