import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, Send, X } from 'lucide-react-native';
import { sendMessage, getOrCreateConversation } from '@/lib/messaging';
import { useAuth } from '@/contexts/AuthContext';

interface QuickMessageProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientType: 'trainer' | 'user';
}

export default function QuickMessage({
  visible,
  onClose,
  clientId,
  clientName,
  clientType,
}: QuickMessageProps) {
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user?.id) return;
    
    // Validate clientId is a valid UUID
    if (!clientId || clientId.startsWith('unknown-')) {
      Alert.alert('Error', 'Invalid client ID. Cannot send message.');
      return;
    }

    setSending(true);
    try {
      // Create or get conversation
      const conversationId = await getOrCreateConversation(
        user.id,
        'trainer', // Current user is always a trainer in this context
        clientId,
        clientType
      );

      // Send the message
      await sendMessage(
        conversationId,
        user.id,
        clientId,
        messageText.trim(),
        'text'
      );

      Alert.alert('Success', 'Message sent successfully!');
      setMessageText('');
      onClose();
    } catch (error) {
      console.error('Error sending quick message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessageText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#FF6B35', '#FF8C42']}
              style={styles.modalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.headerContent}>
                <MessageCircle size={24} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Quick Message</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.clientName}>To: {clientName}</Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              <Text style={styles.messageLabel}>Message:</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Type your message..."
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              
              <View style={styles.messageActions}>
                <TouchableOpacity
                  style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                >
                  <Send size={20} color={messageText.trim() && !sending ? "#FFFFFF" : "#9CA3AF"} />
                  <Text style={[styles.sendButtonText, (!messageText.trim() || sending) && styles.sendButtonTextDisabled]}>
                    {sending ? 'Sending...' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  clientName: {
    fontSize: 16,
    color: '#E5E7EB',
    marginLeft: 36,
  },
  modalBody: {
    padding: 20,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3436',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  messageActions: {
    alignItems: 'flex-end',
  },
  sendButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sendButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
