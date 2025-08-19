import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Send, 
  Search, 
  MessageCircle, 
  Users, 
  Shield
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAllUsersForAdmin, 
  getOrCreateAdminConversation, 
  sendAdminMessage,
  getAdminConversations,
  getAdminConversationMessages,
  markAdminMessagesAsRead,
  searchUsersForAdmin,
  AdminConversationWithParticipant,
  AdminMessage
} from '@/lib/adminMessaging';
import ProfilePicture from '@/components/ProfilePicture';

interface User {
  id: string;
  name: string;
  type: 'user' | 'trainer';
  avatar_url?: string;
  email?: string;
  username?: string;
  is_online?: boolean;
  last_seen?: string;
}

export default function AdminMessagingScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AdminConversationWithParticipant[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<AdminConversationWithParticipant | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const messageInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getAdminConversations(user.id);
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!user) return;
    
    try {
      const data = await getAllUsersForAdmin();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const data = await getAdminConversationMessages(conversationId);
      setMessages(data);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!user) return;
    
    try {
      await markAdminMessagesAsRead(conversationId, user.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchUsersForAdmin(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const startNewConversation = async (targetUser: User) => {
    if (!user) return;

    try {
      setLoading(true);
      
      const conversationId = await getOrCreateAdminConversation(
        user.id,
        targetUser.id,
        targetUser.type
      );

      if (conversationId) {
        let conversation = conversations.find(c => c.id === conversationId);
        
        if (!conversation) {
          conversation = {
            id: conversationId,
            participant_1_id: user.id,
            participant_1_type: 'admin',
            participant_2_id: targetUser.id,
            participant_2_type: targetUser.type,
            last_message_time: new Date().toISOString(),
            unread_count_participant_1: 0,
            unread_count_participant_2: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            other_participant: {
              id: targetUser.id,
              name: targetUser.name,
              type: targetUser.type,
              avatar_url: targetUser.avatar_url
            }
          };
          
          setConversations(prev => [conversation as AdminConversationWithParticipant, ...prev]);
        }

        setSelectedConversation(conversation as AdminConversationWithParticipant);
        setShowUserList(false);
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        
        setTimeout(() => {
          messageInputRef.current?.focus();
        }, 300);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || !messageText.trim()) return;

    try {
      setLoading(true);
      
      const result = await sendAdminMessage(
        selectedConversation.id,
        user.id,
        selectedConversation.other_participant.id,
        messageText.trim()
      );

      if (result.success && result.message) {
        setMessages(prev => [...prev, result.message!]);
        setMessageText('');
        
        setConversations(prev => 
          prev.map(conv => 
            conv.id === selectedConversation.id 
              ? {
                  ...conv,
                  last_message: {
                    content: result.message!.content,
                    sender_id: result.message!.sender_id,
                    created_at: result.message!.created_at,
                    is_admin_message: true
                  },
                  last_message_time: result.message!.created_at
                }
              : conv
          )
        );

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchConversations(),
      fetchUsers()
    ]);
    setRefreshing(false);
  };

     const renderUserItem = ({ item }: { item: User }) => (
     <TouchableOpacity
       style={styles.userItem}
       onPress={() => startNewConversation(item)}
     >
       <ProfilePicture
         avatarUrl={item.avatar_url}
         fullName={item.name}
         size={50}
       />
       <View style={styles.userInfo}>
         <Text style={styles.userName}>{item.name}</Text>
         <Text style={styles.userType}>
           {item.type === 'trainer' ? '🏋️ Trainer' : '💪 Member'}
         </Text>
       </View>
       <TouchableOpacity
         style={styles.startChatButton}
         onPress={() => startNewConversation(item)}
       >
         <MessageCircle size={20} color="#3498DB" />
       </TouchableOpacity>
     </TouchableOpacity>
   );

  const renderMessage = ({ item }: { item: AdminMessage }) => {
    const isAdmin = item.sender_id === user?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isAdmin ? styles.adminMessage : styles.userMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isAdmin ? styles.adminMessageBubble : styles.userMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isAdmin ? styles.adminMessageText : styles.userMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isAdmin ? styles.adminMessageTime : styles.userMessageTime
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        {item.is_admin_message && (
          <View style={styles.adminBadge}>
            <Shield size={12} color="#E74C3C" />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        )}
      </View>
    );
  };

  if (!user) {
    return null;
  }

    // If we have a selected conversation, show the chat interface with KeyboardAvoidingView
  if (selectedConversation) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={['#2C3E50', '#34495E']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedConversation(null)}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Admin Messages</Text>
            <Text style={styles.headerSubtitle}>Send messages to any user or trainer</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Search size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowUserList(!showUserList)}
            >
              <Users size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by name or username..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#95A5A6"
            />
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                <FlatList
                  data={searchResults}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id}
                  style={styles.searchResultsList}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
          </View>
        )}

        {/* Chat Interface */}
        <View style={styles.chatContainer}>
                     {/* Chat Header */}
           <View style={styles.chatHeader}>
             <View style={styles.chatParticipantInfo}>
               <ProfilePicture
                 avatarUrl={selectedConversation.other_participant.avatar_url}
                 fullName={selectedConversation.other_participant.name}
                 size={40}
               />
               <View style={styles.chatParticipantDetails}>
                 <Text style={styles.chatParticipantName}>
                   {selectedConversation.other_participant.name}
                 </Text>
                 <Text style={styles.chatParticipantType}>
                   {selectedConversation.other_participant.type === 'trainer' ? '🏋️ Trainer' : '💪 Member'}
                 </Text>
               </View>
             </View>
           </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          />

          {/* Message Input */}
          <View style={styles.messageInputContainer}>
            <TextInput
              ref={messageInputRef}
              style={styles.messageInput}
              placeholder="Type your message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              placeholderTextColor="#95A5A6"
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || loading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || loading}
            >
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Main screen (user list and empty state)
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#2C3E50', '#34495E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Admin Messages</Text>
          <Text style={styles.headerSubtitle}>Send messages to any user or trainer</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Search size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowUserList(!showUserList)}
          >
            <Users size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#95A5A6"
          />
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <FlatList
                data={searchResults}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id}
                style={styles.searchResultsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      )}

             {/* Recent Conversations */}
       {!showUserList && !showSearch && conversations.length > 0 && (
         <View style={styles.recentConversationsContainer}>
          
          <FlatList
            data={conversations.slice(0, 5)}
            renderItem={({ item: conversation }) => (
              <TouchableOpacity
                style={styles.conversationCard}
                onPress={() => setSelectedConversation(conversation)}
              >
                <View style={styles.conversationHeader}>
                  <ProfilePicture
                    avatarUrl={conversation.other_participant.avatar_url}
                    fullName={conversation.other_participant.name}
                    size={50}
                  />
                  <View style={styles.conversationInfo}>
                    <Text style={styles.conversationName}>
                      {conversation.other_participant.name}
                    </Text>
                    <Text style={styles.conversationType}>
                      {conversation.other_participant.type === 'trainer' ? '🏋️ Trainer' : '💪 Member'}
                    </Text>
                    {conversation.last_message && (
                      <Text style={styles.conversationPreview} numberOfLines={1}>
                        {conversation.last_message.is_admin_message ? '👤 You: ' : ''}
                        {conversation.last_message.content}
                      </Text>
                    )}
                  </View>
                  <View style={styles.conversationTime}>
                    <Text style={styles.conversationTimeText}>
                      {new Date(conversation.last_message_time).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={styles.recentConversationsList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Conditional Content Rendering */}
      {showUserList ? (
        // User List Modal
        <View style={styles.userListContainer}>
          <View style={styles.userListHeader}>
            <Text style={styles.userListTitle}>Select User to Message</Text>
            <TouchableOpacity
              style={styles.closeUserListButton}
              onPress={() => setShowUserList(false)}
            >
              <Text style={styles.closeUserListText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={styles.userList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        </View>
             ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResults: {
    maxHeight: 300,
    marginTop: 10,
  },
  searchResultsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userListContainer: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeUserListButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  closeUserListText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  userList: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
  },
  startMessagingButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startMessagingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backToConversations: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  backToConversationsText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  chatParticipantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  chatParticipantDetails: {
    flex: 1,
  },
  chatParticipantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  chatParticipantType: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  messageContainer: {
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  adminMessage: {
    alignItems: 'flex-end',
  },
  userMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
  },
  adminMessageBubble: {
    backgroundColor: '#3498DB',
    borderBottomRightRadius: 4,
  },
  userMessageBubble: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 5,
  },
  adminMessageText: {
    color: '#FFFFFF',
  },
  userMessageText: {
    color: '#2C3E50',
  },
  messageTime: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  adminMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  userMessageTime: {
    color: '#95A5A6',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    color: '#E74C3C',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  startChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Recent Conversations styles
  recentConversationsContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  recentConversationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentConversationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  viewAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#3498DB',
    borderRadius: 10,
  },
  viewAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  recentConversationsList: {
    maxHeight: 300,
  },
  conversationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  conversationType: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    color: '#5D6D7E',
    lineHeight: 20,
  },
  conversationTime: {
    alignItems: 'flex-end',
  },
  conversationTimeText: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
  },
});
