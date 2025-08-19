import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { 
  Download, 
  Play, 
  File, 
  ThumbsUp,
  Heart,
  Laugh,
  Gift,
  Flame,
  Weight,
  Hand,
  Lightbulb
} from 'lucide-react-native';
import { 
  toggleMessageReaction, 
  getMessageReactionsSummary,
  markMessageAsDelivered,
  markMessageAsRead 
} from '../lib/messaging';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

interface EnhancedMessageProps {
  message: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    timestamp: string;
    is_read: boolean;
    message_type: 'text' | 'image' | 'file';
    delivery_status: 'sent' | 'delivered' | 'read';
    file_url?: string;
    file_name?: string;
    file_size?: number;
    file_type?: string;
    thumbnail_url?: string;
    reply_to_message_id?: string;
  };
  isOwnMessage: boolean;
  onReactionUpdate?: () => void;
}

const REACTION_ICONS = {
  '👍': ThumbsUp,
  '❤️': Heart,
  '😊': Laugh,
  '🎉': Gift,
  '🔥': Flame,
  '💪': Weight,
  '👏': Hand,
  '🤔': Lightbulb,
};

const REACTION_OPTIONS = ['👍', '❤️', '😊', '🎉', '🔥', '💪', '👏', '🤔'];

export default function EnhancedMessage({ 
  message, 
  isOwnMessage, 
  onReactionUpdate 
}: EnhancedMessageProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<any[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [isReacting, setIsReacting] = useState(false);

  useEffect(() => {
    loadReactions();
    
    // Mark message as delivered when component mounts
    if (!isOwnMessage && message.delivery_status === 'sent') {
      markMessageAsDelivered(message.id, user?.id || '');
    }
    
    // Mark message as read when user views it
    if (!isOwnMessage && !message.is_read) {
      markMessageAsRead(message.id, user?.id || '');
    }
  }, [message.id, message.delivery_status, message.is_read, isOwnMessage, user?.id]);

  const loadReactions = async () => {
    try {
      // Skip reactions for temporary messages (they don't exist in database yet)
      if (!message.id || message.id.startsWith('temp_')) {
        setReactions([]);
        return;
      }
      
      // Validate message ID is a proper UUID before calling the function
      if (typeof message.id !== 'string' || message.id.length !== 36) {
        console.warn('Invalid message ID format for reactions:', message.id);
        setReactions([]);
        return;
      }
      
      const reactionsSummary = await getMessageReactionsSummary(message.id);
      setReactions(reactionsSummary);
    } catch (error) {
      console.error('Error loading reactions:', error);
      setReactions([]);
    }
  };

  const handleReaction = async (reactionType: string) => {
    if (!user?.id || isReacting) return;
    
    setIsReacting(true);
    try {
      await toggleMessageReaction(message.id, user.id, reactionType);
      await loadReactions();
      onReactionUpdate?.();
    } catch (error) {
      console.error('Error toggling reaction:', error);
      Alert.alert('Error', 'Failed to add reaction. Please try again.');
    } finally {
      setIsReacting(false);
      setShowReactions(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderAttachment = () => {
    if (!message.file_url) return null;

    const isImage = message.message_type === 'image';
    const isVideo = message.file_type?.startsWith('video/');
    const isAudio = message.file_type?.startsWith('audio/');

    return (
      <View style={styles.attachmentContainer}>
        {isImage && (
          <Image 
            source={{ uri: message.file_url }} 
            style={styles.imageAttachment}
            resizeMode="cover"
          />
        )}
        
        {!isImage && (
          <View style={styles.fileAttachment}>
            <View style={styles.fileIcon}>
              {isVideo ? (
                <Play size={24} color="#6C5CE7" />
              ) : isAudio ? (
                <Play size={24} color="#6C5CE7" />
              ) : (
                <File size={24} color="#6C5CE7" />
              )}
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {message.file_name || 'File'}
              </Text>
              <Text style={styles.fileSize}>
                {message.file_size ? formatFileSize(message.file_size) : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.downloadButton}>
              <Download size={20} color="#6C5CE7" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderReactions = () => {
    if (reactions.length === 0) return null;

    return (
      <View style={styles.reactionsContainer}>
        {reactions.map((reaction, index) => (
          <View key={index} style={styles.reactionItem}>
            <Text style={styles.reactionEmoji}>{reaction.reaction_type}</Text>
            <Text style={styles.reactionCount}>{reaction.count}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDeliveryStatus = () => {
    if (!isOwnMessage) return null;

    let statusIcon = null;
    let statusColor = '#9CA3AF';

    switch (message.delivery_status) {
      case 'sent':
        statusIcon = '✓';
        break;
      case 'delivered':
        statusIcon = '✓✓';
        statusColor = '#6C5CE7';
        break;
      case 'read':
        statusIcon = '✓✓';
        statusColor = '#10B981';
        break;
    }

    return (
      <Text style={[styles.deliveryStatus, { color: statusColor }]}>
        {statusIcon}
      </Text>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      <View style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
      ]}>
        {/* Reply indicator */}
        {message.reply_to_message_id && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText}>Replying to message...</Text>
          </View>
        )}

        {/* Message content */}
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {message.content}
        </Text>

        {/* Attachment */}
        {renderAttachment()}

        {/* Message footer */}
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          
          {renderDeliveryStatus()}
        </View>

        {/* Reactions */}
        {renderReactions()}
      </View>

      {/* Reaction button */}
      <TouchableOpacity
        style={[
          styles.reactionButton,
          {
            right: isOwnMessage ? -8 : undefined,
            left: isOwnMessage ? undefined : -8,
          }
        ]}
        onPress={() => setShowReactions(!showReactions)}
        disabled={isReacting}
      >
        <Text style={styles.reactionButtonText}>+</Text>
      </TouchableOpacity>

      {/* Reaction picker */}
      {showReactions && (
        <View style={[
          styles.reactionPicker,
          {
            right: isOwnMessage ? 0 : undefined,
            left: isOwnMessage ? undefined : 0,
          }
        ]}>
          {REACTION_OPTIONS.map((reaction) => (
            <TouchableOpacity
              key={reaction}
              style={styles.reactionOption}
              onPress={() => handleReaction(reaction)}
            >
              <Text style={styles.reactionOptionText}>{reaction}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownMessageBubble: {
    backgroundColor: '#6C5CE7',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#2D3436',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  deliveryStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  attachmentContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  imageAttachment: {
    width: Math.min(screenWidth * 0.6, 300),
    height: 200,
    borderRadius: 12,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  downloadButton: {
    padding: 8,
  },
  replyIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
  },
  reactionButton: {
    position: 'absolute',
    bottom: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  reactionPicker: {
    position: 'absolute',
    bottom: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reactionOption: {
    padding: 8,
    marginHorizontal: 2,
  },
  reactionOptionText: {
    fontSize: 20,
  },
});
