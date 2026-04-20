/**
 * Reply Modal Component
 * 
 * Modal for replying to posts on social media
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X, Send } from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { SocialPost } from '@/contexts/game/types';

interface ReplyModalProps {
  visible: boolean;
  post: SocialPost | null;
  onClose: () => void;
  onSubmit: (content: string) => void;
}

export default function ReplyModal({ visible, post, onClose, onSubmit }: ReplyModalProps) {
  const [replyText, setReplyText] = useState('');
  
  const handleSubmit = () => {
    if (replyText.trim()) {
      onSubmit(replyText.trim());
      setReplyText('');
    }
  };
  
  const handleClose = () => {
    setReplyText('');
    onClose();
  };
  
  if (!post) return null;
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.container}>
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose}>
                  <X size={24} color="#E7E9EA" />
                </TouchableOpacity>
                <Text style={styles.title}>Reply</Text>
                <View style={{ width: 24 }} />
              </View>
              
              <ScrollView
                style={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Original Post */}
                <View style={styles.originalPost}>
                  <Text style={styles.originalAuthor}>@{post.authorHandle}</Text>
                  <Text style={styles.originalContent}>{post.content}</Text>
                </View>
                
                {/* Reply Input */}
                <TextInput
                  style={styles.input}
                  placeholder="Tweet your reply"
                  placeholderTextColor="#71767B"
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  maxLength={280}
                  autoFocus
                />
              </ScrollView>
              
              <View style={styles.footer}>
                <Text style={styles.charCount}>{replyText.length}/280</Text>
                <TouchableOpacity
                  style={[styles.submitButton, !replyText.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!replyText.trim()}
                >
                  <Send size={20} color="#FFFFFF" />
                  <Text style={styles.submitText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: scale(16),
    maxHeight: '90%',
    minHeight: scale(300),
  },
  scrollContent: {
    flex: 1,
    maxHeight: scale(400),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  originalPost: {
    padding: scale(12),
    backgroundColor: '#16181C',
    borderRadius: 12,
    marginBottom: scale(16),
  },
  originalAuthor: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginBottom: scale(4),
  },
  originalContent: {
    fontSize: fontScale(15),
    color: '#E7E9EA',
  },
  input: {
    fontSize: fontScale(20),
    color: '#E7E9EA',
    minHeight: scale(100),
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(16),
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  charCount: {
    fontSize: fontScale(14),
    color: '#71767B',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D9BF0',
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: 20,
    gap: scale(8),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

