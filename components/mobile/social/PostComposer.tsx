/**
 * Post Composer Component - X.com Style
 * 
 * Modal for creating new posts with photo upload
 */
import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Image as ImageIcon,
  Camera,
  MapPin,
  BadgeCheck,
  Globe,
} from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { pickPostPhoto, showImageSourcePicker, takePhoto, PLACEHOLDER_IMAGES } from '@/utils/imageUtils';

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPost: (content: string, photo?: string) => void;
  profilePhoto?: string;
  displayName: string;
  username: string;
  verified?: boolean;
  maxLength?: number;
}

const MAX_POST_LENGTH = 280;

export default function PostComposer({
  visible,
  onClose,
  onPost,
  profilePhoto,
  displayName,
  username,
  verified,
  maxLength = MAX_POST_LENGTH,
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [isPosting, setIsPosting] = useState(false);
  
  const charactersRemaining = maxLength - content.length;
  const isOverLimit = charactersRemaining < 0;
  const canPost = (content.trim().length > 0 || photo) && !isOverLimit && !isPosting;
  
  const handlePost = useCallback(async () => {
    if (!canPost) return;
    
    setIsPosting(true);
    try {
      await onPost(content.trim(), photo);
      setContent('');
      setPhoto(undefined);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  }, [content, photo, canPost, onPost, onClose]);
  
  const handleAddPhoto = useCallback(() => {
    showImageSourcePicker(
      async () => {
        const result = await pickPostPhoto();
        if (result.success && result.base64) {
          setPhoto(result.base64);
        }
      },
      async () => {
        const result = await takePhoto({ aspect: [4, 3] });
        if (result.success && result.base64) {
          setPhoto(result.base64);
        }
      }
    );
  }, []);
  
  const handleRemovePhoto = useCallback(() => {
    setPhoto(undefined);
  }, []);
  
  const handleClose = useCallback(() => {
    if (content.trim().length > 0 || photo) {
      Alert.alert(
        'Discard post?',
        'Your post will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              setContent('');
              setPhoto(undefined);
              onClose();
            }
          },
        ]
      );
    } else {
      onClose();
    }
  }, [content, photo, onClose]);
  
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
            <X size={scale(24)} color="#E7E9EA" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.postButton,
              !canPost && styles.postButtonDisabled
            ]}
            onPress={handlePost}
            disabled={!canPost}
          >
            <Text style={[
              styles.postButtonText,
              !canPost && styles.postButtonTextDisabled
            ]}>
              {isPosting ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Composer Area */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.composerRow}>
            {/* Profile Photo */}
            <Image
              source={{ uri: profilePhoto || PLACEHOLDER_IMAGES.profile }}
              style={styles.avatar}
            />
            
            {/* Input Area */}
            <View style={styles.inputArea}>
              {/* Top Action Bar - Add Photo Button */}
              <View style={styles.topActionBar}>
                <TouchableOpacity style={styles.audienceSelector}>
                  <Globe size={scale(14)} color="#1D9BF0" />
                  <Text style={styles.audienceText}>Everyone can reply</Text>
                </TouchableOpacity>
                
                {!photo && (
                  <TouchableOpacity 
                    style={styles.addPhotoButton}
                    onPress={handleAddPhoto}
                  >
                    <ImageIcon size={scale(20)} color="#1D9BF0" />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Text Input */}
              <TextInput
                style={styles.textInput}
                placeholder="What's happening?"
                placeholderTextColor="#71767B"
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={maxLength + 20} // Allow slight overage for display
                autoFocus
              />
              
              {/* Photo Preview */}
              {photo && (
                <View style={styles.photoPreview}>
                  <Image
                    source={{ uri: photo }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={handleRemovePhoto}
                  >
                    <X size={scale(16)} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        
        {/* Bottom Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <TouchableOpacity 
              style={styles.toolbarButton}
              onPress={handleAddPhoto}
            >
              <ImageIcon size={scale(22)} color="#1D9BF0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton}>
              <Camera size={scale(22)} color="#1D9BF0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton}>
              <MapPin size={scale(22)} color="#1D9BF0" />
            </TouchableOpacity>
          </View>
          
          {/* Character Counter */}
          <View style={styles.toolbarRight}>
            {content.length > 0 && (
              <>
                <View style={styles.characterCountContainer}>
                  <View 
                    style={[
                      styles.characterCountRing,
                      isOverLimit && styles.characterCountRingOver,
                      charactersRemaining <= 20 && !isOverLimit && styles.characterCountRingWarning,
                    ]}
                  >
                    {charactersRemaining <= 20 && (
                      <Text style={[
                        styles.characterCountText,
                        isOverLimit && styles.characterCountTextOver,
                      ]}>
                        {charactersRemaining}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}
          </View>
        </View>
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
  postButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
  },
  postButtonDisabled: {
    backgroundColor: 'rgba(29, 155, 240, 0.5)',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: 'bold',
  },
  postButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(16),
  },
  composerRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#1F2937',
    marginRight: scale(12),
  },
  inputArea: {
    flex: 1,
  },
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  audienceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingVertical: scale(4),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: '#1D9BF0',
    borderRadius: scale(20),
  },
  audienceText: {
    fontSize: fontScale(13),
    color: '#1D9BF0',
    fontWeight: '500',
  },
  addPhotoButton: {
    padding: scale(8),
  },
  textInput: {
    fontSize: fontScale(18),
    color: '#E7E9EA',
    minHeight: scale(100),
    textAlignVertical: 'top',
  },
  photoPreview: {
    position: 'relative',
    marginTop: scale(12),
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: scale(200),
    backgroundColor: '#1F2937',
  },
  removePhotoButton: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: scale(8),
    borderRadius: scale(20),
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  toolbarLeft: {
    flexDirection: 'row',
    gap: scale(16),
  },
  toolbarButton: {
    padding: scale(4),
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  characterCountContainer: {
    width: scale(24),
    height: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterCountRing: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: '#1D9BF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterCountRingWarning: {
    borderColor: '#F59E0B',
  },
  characterCountRingOver: {
    borderColor: '#EF4444',
  },
  characterCountText: {
    fontSize: fontScale(10),
    color: '#F59E0B',
    fontWeight: 'bold',
  },
  characterCountTextOver: {
    color: '#EF4444',
  },
  divider: {
    width: 1,
    height: scale(24),
    backgroundColor: '#2F3336',
  },
});

