import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { 
  MessageCircle, 
  Send, 
  Search, 
  Users, 
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Image as ImageIcon,
  Paperclip,
  Camera,
  FileText
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  getUserConversations, 
  getConversationMessages, 
  sendMessage as sendMessageAPI,
  markMessagesAsRead,
  searchConversations,
  uploadFileToStorage,
  ConversationWithParticipant,
  MessageWithSender
} from '@/lib/messaging';
import EnhancedMessage from '@/components/EnhancedMessage';

interface Conversation {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_username: string;
  participant_type: 'trainer' | 'client';
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_online: boolean;
  profile_image?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'file';
  // Enhanced features
  delivery_status: 'sent' | 'delivered' | 'read';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  thumbnail_url?: string;
  reply_to_message_id?: string;
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  
  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAttachment, setSelectedAttachment] = useState<{
    type: 'image' | 'file';
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      filterConversations();
    } else {
      setFilteredConversations(conversations || []);
    }
  }, [searchQuery, conversations]);

  useEffect(() => {
    if (selectedConversation?.id && selectedConversation?.participant_id) {
      fetchMessages(selectedConversation.participant_id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      
      const apiConversations = await getUserConversations(user.id);
      
      // Transform API data to match our UI interface
      const transformedConversations: Conversation[] = apiConversations.map(conv => ({
        id: conv.id,
        participant_id: conv.other_participant?.id || '',
        participant_name: conv.other_participant?.name || 'Unknown User',
        participant_username: conv.other_participant?.name || 'unknown',
        participant_type: conv.other_participant?.type || 'user',
        last_message: conv.last_message?.content || 'No messages yet',
        last_message_time: formatTimeAgo(new Date(conv.last_message_time || new Date())),
        unread_count: conv.unread_count_participant_1 || conv.unread_count_participant_2 || 0,
        is_online: false, // TODO: Implement online status
      }));
      
      setConversations(transformedConversations || []);
    } catch (error) {
      // Fallback to empty array
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (participantId: string) => {
    try {
      if (!user?.id || !selectedConversation?.id) return;
      
      const apiMessages = await getConversationMessages(selectedConversation.id);
      
      // Transform API data to match our UI interface
      const transformedMessages: Message[] = apiMessages.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        content: msg.content,
        timestamp: msg.created_at,
        is_read: msg.is_read,
        message_type: msg.message_type,
        // Enhanced features
        delivery_status: msg.delivery_status || 'sent',
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_size: msg.file_size,
        file_type: msg.file_type,
        thumbnail_url: msg.thumbnail_url,
        reply_to_message_id: msg.reply_to_message_id,
      }));
      
      setMessages(transformedMessages || []);
      
      // Mark messages as read
      if (selectedConversation?.id) {
        await markMessagesAsRead(selectedConversation.id, user.id);
      }
    } catch (error) {
      setMessages([]);
    }
  };

  const filterConversations = async () => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations || []);
      return;
    }

    try {
      if (!user?.id) return;
      
      const searchResults = await searchConversations(user.id, searchQuery);
      
      // Transform API search results to match our UI interface
      const transformedResults: Conversation[] = searchResults.map(conv => ({
        id: conv.id,
        participant_id: conv.other_participant?.id || '',
        participant_name: conv.other_participant?.name || 'Unknown User',
        participant_username: conv.other_participant?.name || 'unknown',
        participant_type: conv.other_participant?.type || 'user',
        last_message: conv.last_message?.content || 'No messages yet',
        last_message_time: formatTimeAgo(new Date(conv.last_message_time || new Date())),
        unread_count: conv.unread_count_participant_1 || conv.unread_count_participant_2 || 0,
        is_online: false, // TODO: Implement online status
      }));
      
      setFilteredConversations(transformedResults || []);
    } catch (error) {
      // Fallback to local filtering
      const filtered = (conversations || []).filter(conversation =>
        conversation.participant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.participant_username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered || []);
    }
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !selectedAttachment) || !selectedConversation?.id || !user?.id) return;

    try {
      setIsUploading(true);
      let messageType: 'text' | 'image' | 'file' = 'text';
      let attachment = undefined;

      if (selectedAttachment) {
        messageType = selectedAttachment.type;
        
        // Upload file to Supabase storage
        let uploadedFileUrl = null;
        if (selectedAttachment.type === 'image' || selectedAttachment.type === 'file') {
          uploadedFileUrl = await uploadFileToStorage(
            selectedAttachment.uri,
            selectedAttachment.name,
            selectedAttachment.mimeType || 'application/octet-stream'
          );
          
          if (!uploadedFileUrl) {
            Alert.alert('Error', 'Failed to upload file. Please try again.');
            return;
          }
        }
        
        attachment = {
          file_url: uploadedFileUrl,
          file_name: selectedAttachment.name,
          file_size: selectedAttachment.size || 0,
          file_type: selectedAttachment.mimeType || 'application/octet-stream',
          thumbnail_url: selectedAttachment.type === 'image' ? uploadedFileUrl : undefined,
        };
      }

      // Send message via API
      const sentMessage = await sendMessageAPI(
        selectedConversation.id,
        user.id,
        selectedConversation.participant_id,
        messageText.trim() || (selectedAttachment ? `Sent ${selectedAttachment.type}` : ''),
        messageType,
        attachment
      );

      // Create local message object for UI
      const newMessage: Message = {
        id: sentMessage?.id || Date.now().toString(),
        sender_id: user.id,
        receiver_id: selectedConversation.participant_id || '',
        content: messageText.trim() || (selectedAttachment ? `Sent ${selectedAttachment.type}` : ''),
        timestamp: sentMessage?.created_at || new Date().toISOString(),
        is_read: false,
        message_type: messageType,
        // Enhanced features
        delivery_status: 'sent',
        file_url: attachment?.file_url,
        file_name: attachment?.file_name,
        file_size: attachment?.file_size,
        file_type: attachment?.file_type,
        thumbnail_url: attachment?.thumbnail_url,
        reply_to_message_id: undefined,
      };

      // Add message to local state
      setMessages(prev => [newMessage, ...(prev || [])]);
      
      // Update conversation last message
      if (selectedConversation?.id) {
        setConversations(prev => 
          (prev || []).map(conv => 
            conv.id === selectedConversation.id 
              ? { 
                  ...conv, 
                  last_message: messageText.trim() || (selectedAttachment ? `Sent ${selectedAttachment.type}` : ''),
                  last_message_time: 'Just now',
                  unread_count: 0
                }
              : conv
          )
        );
      }

      setMessageText('');
      setSelectedAttachment(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const markAsRead = (conversationId: string) => {
    if (!conversationId) return;
    setConversations(prev => 
      (prev || []).map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );
  };

  const openChat = (conversation: Conversation) => {
    if (!conversation?.id) return;
    setSelectedConversation(conversation);
    if (conversation.id) {
      markAsRead(conversation.id);
    }
    setShowChat(true);
  };

  const closeChat = () => {
    setShowChat(false);
    setSelectedConversation(null);
    setMessages([]);
    setSelectedAttachment(null);
    setShowAttachmentOptions(false);
    setIsUploading(false);
  };

  // File and Image Handling Functions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to select images.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

             const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ['images'],
         allowsEditing: true,
         aspect: [4, 3],
         quality: 0.8,
       });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedAttachment({
          type: 'image',
          uri: asset.uri,
          name: `image_${Date.now()}.jpg`,
          size: asset.fileSize,
          mimeType: 'image/jpeg',
        });
        setShowAttachmentOptions(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }

             const result = await ImagePicker.launchCameraAsync({
         mediaTypes: ['images'],
         allowsEditing: true,
         aspect: [4, 3],
         quality: 0.8,
       });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedAttachment({
          type: 'image',
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          size: asset.fileSize,
          mimeType: 'image/jpeg',
        });
        setShowAttachmentOptions(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedAttachment({
          type: 'file',
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
        });
        setShowAttachmentOptions(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const removeAttachment = () => {
    setSelectedAttachment(null);
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => openChat(item)}
    >
      <View style={styles.conversationAvatar}>
        <Text style={styles.conversationInitials}>
          {item.participant_name ? item.participant_name.split(' ').map(n => n[0]).join('') : 'U'}
        </Text>
        {item.is_online && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.participant_name || 'Unknown User'}</Text>
          <Text style={styles.conversationTime}>{item.last_message_time}</Text>
        </View>
        <View style={styles.conversationFooter}>
          <Text style={styles.conversationLastMessage} numberOfLines={1}>
            {item.last_message || 'No messages yet'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    
    return (
      <EnhancedMessage
        message={{
          id: item.id,
          sender_id: item.sender_id,
          receiver_id: item.receiver_id,
          content: item.content,
          timestamp: item.timestamp,
          is_read: item.is_read,
          message_type: item.message_type,
          delivery_status: item.delivery_status,
          file_url: item.file_url,
          file_name: item.file_name,
          file_size: item.file_size,
          file_type: item.file_type,
          thumbnail_url: item.thumbnail_url,
          reply_to_message_id: item.reply_to_message_id,
        }}
        isOwnMessage={isOwnMessage}
        onReactionUpdate={() => {
          // Refresh messages when reactions change
          if (selectedConversation) {
            fetchMessages(selectedConversation.participant_id);
          }
        }}
      />
    );
  };

  if (showChat && selectedConversation) {
    return (
      <View style={styles.chatContainer}>
        {/* Chat Header */}
        <LinearGradient
          colors={['#6C5CE7', '#A855F7']}
          style={styles.chatHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.chatHeaderContent}>
            <TouchableOpacity onPress={closeChat} style={styles.backButton}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.chatParticipantInfo}>
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarInitials}>
                  {selectedConversation.participant_name ? selectedConversation.participant_name.split(' ').map(n => n[0]).join('') : 'U'}
                </Text>
                {selectedConversation.is_online && <View style={styles.chatOnlineIndicator} />}
              </View>
              <View>
                <Text style={styles.chatParticipantName}>{selectedConversation.participant_name || 'Unknown User'}</Text>
                <Text style={styles.chatParticipantStatus}>
                  {selectedConversation.is_online ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.moreButton}>
              <MoreVertical size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Messages */}
        <FlatList
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          inverted
          showsVerticalScrollIndicator={false}
        />

                 {/* Message Input */}
         <KeyboardAvoidingView
           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
           style={styles.messageInputContainer}
         >
           {/* Attachment Options Modal */}
           {showAttachmentOptions && (
             <View style={styles.attachmentOptionsModal}>
               <View style={styles.attachmentOptionsContent}>
                 <TouchableOpacity style={styles.attachmentOption} onPress={takePhoto}>
                   <Camera size={24} color="#6C5CE7" />
                   <Text style={styles.attachmentOptionText}>Take Photo</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.attachmentOption} onPress={pickImage}>
                   <ImageIcon size={24} color="#6C5CE7" />
                   <Text style={styles.attachmentOptionText}>Choose Photo</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
                   <FileText size={24} color="#6C5CE7" />
                   <Text style={styles.attachmentOptionText}>Choose File</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={styles.attachmentOption} 
                   onPress={() => setShowAttachmentOptions(false)}
                 >
                   <Text style={styles.attachmentOptionText}>Cancel</Text>
                 </TouchableOpacity>
               </View>
             </View>
           )}

           {/* Selected Attachment Preview */}
           {selectedAttachment && (
             <View style={styles.attachmentPreview}>
               {selectedAttachment.type === 'image' ? (
                 <Image source={{ uri: selectedAttachment.uri }} style={styles.attachmentImage} />
               ) : (
                 <View style={styles.attachmentFile}>
                   <FileText size={24} color="#6C5CE7" />
                   <Text style={styles.attachmentFileName} numberOfLines={1}>
                     {selectedAttachment.name}
                   </Text>
                 </View>
               )}
               <TouchableOpacity style={styles.removeAttachmentButton} onPress={removeAttachment}>
                 <Text style={styles.removeAttachmentText}>✕</Text>
               </TouchableOpacity>
             </View>
           )}

           <View style={styles.messageInputWrapper}>
             <TouchableOpacity 
               style={styles.attachmentButton}
               onPress={() => setShowAttachmentOptions(!showAttachmentOptions)}
             >
               <Paperclip size={20} color="#6B7280" />
             </TouchableOpacity>
             
             <TextInput
               style={styles.messageInput}
               placeholder="Type a message..."
               value={messageText}
               onChangeText={setMessageText}
               multiline
               maxLength={500}
             />
             
             <TouchableOpacity
               style={[
                 styles.sendButton, 
                 (!messageText.trim() && !selectedAttachment) && styles.sendButtonDisabled
               ]}
               onPress={sendMessage}
               disabled={(!messageText.trim() && !selectedAttachment) || isUploading}
             >
               {isUploading ? (
                 <Text style={styles.uploadingText}>...</Text>
               ) : (
                 <Send size={20} color={(messageText.trim() || selectedAttachment) ? "#FFFFFF" : "#9CA3AF"} />
               )}
             </TouchableOpacity>
           </View>
         </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6C5CE7', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerContent}>
          <Text style={styles.subtitle}>
            {isTrainer() ? 'Chat with your clients' : 'Chat with your trainers'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Conversations List */}
        <View style={styles.conversationsContainer}>
          <Text style={styles.sectionTitle}>
            {isTrainer() ? 'Client Conversations' : 'Trainer Conversations'}
          </Text>
          
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Loading conversations...</Text>
            </View>
          ) : !filteredConversations || filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No conversations yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {isTrainer() 
                  ? 'Start messaging your clients from the Client Dashboard'
                  : 'Connect with trainers to start conversations'
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              renderItem={renderConversationItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.conversationsList}
            />
          )}
        </View>
      </View>

    </View>
  );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    lineHeight: 22,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  conversationsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  conversationInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  conversationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Chat Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatHeader: {
    paddingTop: 60,
    paddingBottom: 16,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  chatParticipantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  chatAvatarInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  chatOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatParticipantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  chatParticipantStatus: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  moreButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  messageInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  messageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    maxHeight: 100,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#6C5CE7',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },

  // Attachment Styles
  attachmentOptionsModal: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  attachmentOptionsContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  attachmentOptionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 16,
    fontWeight: '500',
  },
  attachmentPreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachmentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  attachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentFileName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  removeAttachmentButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
