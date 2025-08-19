import { supabase } from './supabase';
import { canSendMessage } from './privacySettings';

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  participant_1_type: 'user' | 'trainer';
  participant_2_type: 'user' | 'trainer';
  last_message_id?: string;
  last_message_time: string;
  unread_count_participant_1: number;
  unread_count_participant_2: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  // Enhanced fields
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  thumbnail_url?: string;
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed';
  delivered_at?: string;
  reply_to_message_id?: string;
}

export interface ConversationWithParticipant extends Conversation {
  other_participant: {
    id: string;
    name: string;
    type: 'user' | 'trainer';
    avatar_url?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
}

export interface MessageWithSender extends Message {
  sender: {
    id: string;
    name: string;
    type: 'user' | 'trainer';
    avatar_url?: string;
  };
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  thumbnail_url?: string;
  mime_type?: string;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  new_messages: boolean;
  message_reactions: boolean;
  trainer_requests: boolean;
  workout_updates: boolean;
  session_reminders: boolean;
  achievements: boolean;
  created_at: string;
  updated_at: string;
}

// Get user conversations with participant info
export const getUserConversations = async (userId: string): Promise<ConversationWithParticipant[]> => {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages!inner(
          id,
          content,
          sender_id,
          created_at
        )
      `)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_time', { ascending: false });

    if (error) throw error;

    // Transform conversations to include participant info
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipantId = conv.participant_1_id === userId 
          ? conv.participant_2_id 
          : conv.participant_1_id;
        
        const otherParticipantType = conv.participant_1_id === userId 
          ? conv.participant_2_type 
          : conv.participant_1_type;

        // Get participant profile info - always fetch from user_profiles for names
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', otherParticipantId)
          .single();

        const lastMessage = conv.messages && conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1] 
          : undefined;

        return {
          ...conv,
          other_participant: {
            id: otherParticipantId,
            name: profile?.full_name || profile?.username || 'Unknown User',
            type: otherParticipantType,
            avatar_url: profile?.avatar_url
          },
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at
          } : undefined
        };
      })
    );

    return conversationsWithParticipants;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
};

// Get conversation messages with sender info
export const getConversationMessages = async (conversationId: string): Promise<MessageWithSender[]> => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform messages to include sender info by fetching profiles separately
    const messagesWithSenders = await Promise.all(
      messages.map(async (msg) => {
        // Get sender profile info
        const { data: senderProfile } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', msg.sender_id)
          .single();

        return {
          ...msg,
          sender: {
            id: msg.sender_id,
            name: senderProfile?.full_name || senderProfile?.username || 'Unknown User',
            type: 'user', // You might want to determine this from user_profiles.user_type
            avatar_url: senderProfile?.avatar_url
          }
        };
      })
    );

    return messagesWithSenders;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

// Send a message
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'system' = 'text',
  attachment?: {
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    thumbnail_url?: string;
  }
): Promise<{ success: boolean; message?: Message; error?: string }> => {
  try {
    // Check if sender can send message to receiver based on privacy settings
    const canSend = await canSendMessage(receiverId);
    if (!canSend) {
      // Create notification for sender about blocked message using RPC
      await supabase.rpc('create_notification', {
        p_user_id: senderId,
        p_type: 'new_message',
        p_title: 'Message Blocked',
        p_message: 'This user is not allowing messages at the moment',
        p_data: { blocked_user_id: receiverId, reason: 'privacy_settings' }
      });

      return {
        success: false,
        error: 'This user is not allowing messages at the moment'
      };
    }

    const messageData: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      delivery_status: 'sent'
    };

    // Add attachment data if present
    if (attachment) {
      Object.assign(messageData, attachment);
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_id: message.id,
        last_message_time: message.created_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    // Create notification for the receiver about the new message
    try {
      await supabase.rpc('create_notification', {
        p_user_id: receiverId,
        p_type: 'new_message',
        p_title: 'New Message',
        p_message: `You have a new message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        p_data: { 
          conversation_id: conversationId,
          sender_id: senderId,
          message_id: message.id,
          message_preview: content.substring(0, 100)
        }
      });
    } catch (notificationError) {
      console.log('⚠️ Could not create notification for new message:', notificationError);
      // Don't fail the message send if notification fails
    }

    return {
      success: true,
      message
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
};

// Get or create conversation between two users
export const getOrCreateConversation = async (
  user1Id: string,
  user1Type: 'user' | 'trainer',
  user2Id: string,
  user2Type: 'user' | 'trainer'
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .rpc('get_or_create_conversation', {
        p_user1_id: user1Id,
        p_user1_type: user1Type,
        p_user2_id: user2Id,
        p_user2_type: user2Type
      });

    if (error) throw error;
    return data;
  } catch (error) {
    return null;
  }
};

// Mark messages as read
export const markMessagesAsRead = async (conversationId: string, userId: string): Promise<void> => {
  try {
    await supabase
      .rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });
  } catch (error) {
    // Handle error silently
  }
};

// Get unread message count
export const getUnreadMessageCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    return 0;
  }
};

// Delete a message
export const deleteMessage = async (messageId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    return false;
  }
};

// Get conversation by participants
export const getConversationByParticipants = async (
  user1Id: string,
  user2Id: string
): Promise<Conversation | null> => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1_id.eq.${user1Id},participant_2_id.eq.${user2Id}),and(participant_1_id.eq.${user2Id},participant_2_id.eq.${user1Id})`)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    return null;
  }
};

// Search conversations
export const searchConversations = async (userId: string, query: string): Promise<ConversationWithParticipant[]> => {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages!inner(
          content
        )
      `)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .textSearch('messages.content', query)
      .order('last_message_time', { ascending: false });

    if (error) throw error;

    // Transform conversations similar to getUserConversations
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipantId = conv.participant_1_id === userId 
          ? conv.participant_2_id 
          : conv.participant_1_id;
        
        const otherParticipantType = conv.participant_1_id === userId 
          ? conv.participant_2_type 
          : conv.participant_1_type;

        // Get participant profile info - always fetch from user_profiles for names
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', otherParticipantId)
          .single();

        const lastMessage = conv.messages && conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1] 
          : undefined;

        return {
          ...conv,
          other_participant: {
            id: otherParticipantId,
            name: profile?.full_name || profile?.username || 'Unknown User',
            type: otherParticipantType,
            avatar_url: profile?.avatar_url
          },
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_id: otherParticipantId, // This will be the last message sender
            created_at: new Date().toISOString() // We don't have this in the search results
          } : undefined
        };
      })
    );

    return conversationsWithParticipants;
  } catch (error) {
    console.error('Error searching conversations:', error);
    return [];
  }
};

// Enhanced messaging features

// Toggle message reaction
export const toggleMessageReaction = async (
  messageId: string,
  userId: string,
  reactionType: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('toggle_message_reaction', {
        p_message_id: messageId,
        p_user_id: userId,
        p_reaction_type: reactionType
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return false;
  }
};

// Get message reactions summary
export const getMessageReactionsSummary = async (messageId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_message_reactions_summary', {
        p_message_id: messageId
      });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting reactions summary:', error);
    return [];
  }
};

// Update message delivery status
export const updateMessageDeliveryStatus = async (
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  userId: string
): Promise<void> => {
  try {
    await supabase
      .rpc('update_message_delivery_status', {
        p_message_id: messageId,
        p_status: status,
        p_user_id: userId
      });
  } catch (error) {
    console.error('Error updating delivery status:', error);
  }
};

// Send message with attachment
export const sendMessageWithAttachment = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  attachment: {
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    thumbnail_url?: string;
  }
): Promise<{ success: boolean; message?: Message; error?: string }> => {
  return sendMessage(conversationId, senderId, receiverId, content, 'file', attachment);
};

// Upload file to Supabase storage
export const uploadFileToStorage = async (
  fileUri: string,
  fileName: string,
  mimeType: string,
  bucketName: string = 'message-attachments'
): Promise<string | null> => {
  try {
    // Convert file URI to blob
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Generate unique filename
    const uniqueFileName = `${Date.now()}_${fileName}`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueFileName, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uniqueFileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};

// Get notification preferences
export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences | null> => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return null;
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return false;
  }
};

// Get unread message count with delivery status
export const getUnreadMessageCountWithStatus = async (userId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_unread_message_count_with_status', {
        p_user_id: userId
      });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting unread count with status:', error);
    return [];
  }
};

// Mark message as delivered
export const markMessageAsDelivered = async (messageId: string, userId: string): Promise<void> => {
  await updateMessageDeliveryStatus(messageId, 'delivered', userId);
};

// Mark message as read
export const markMessageAsRead = async (messageId: string, userId: string): Promise<void> => {
  await updateMessageDeliveryStatus(messageId, 'read', userId);
};

// Get connected users for starting new conversations
export const getConnectedUsers = async (userId: string): Promise<{
  id: string;
  name: string;
  type: 'user' | 'trainer';
  avatar_url?: string;
  specialty?: string;
  hourly_rate?: number;
  is_online?: boolean;
  last_seen?: string;
}[]> => {
  try {
    // Get user's connections (both as user and as trainer)
    const { data: connections, error } = await supabase
      .from('trainer_user_connections')
      .select(`
        user_id,
        trainer_id,
        user_profiles!trainer_user_connections_user_id_fkey (
          id,
          full_name,
          username,
          avatar_url,
          user_type
        )
      `)
      .or(`user_id.eq.${userId},trainer_id.eq.${userId}`);

    if (error) {
      console.error('Error fetching connections:', error);
      return [];
    }

    if (!connections) return [];

    // Transform connections to connected users
    const connectedUsers: {
      id: string;
      name: string;
      type: 'user' | 'trainer';
      avatar_url?: string;
      specialty?: string;
      hourly_rate?: number;
      is_online?: boolean;
      last_seen?: string;
    }[] = [];

    for (const connection of connections) {
      if (connection.user_id === userId) {
        // Current user is the user, so the other person is the trainer
        const otherUserId = connection.trainer_id;
        
        // Get the trainer's profile information
        const { data: trainerProfile } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', otherUserId)
          .single();

        // Get trainer-specific information
        const { data: trainerDetails } = await supabase
          .from('trainer_profiles')
          .select('specialty, hourly_rate')
          .eq('id', otherUserId)
          .single();

        // Get online status
        const { data: onlineStatus } = await supabase
          .rpc('get_user_online_status', { p_user_id: otherUserId });

        if (trainerProfile) {
          connectedUsers.push({
            id: otherUserId,
            name: trainerProfile.full_name || trainerProfile.username || 'Unknown Trainer',
            type: 'trainer',
            avatar_url: trainerProfile.avatar_url,
            specialty: trainerDetails?.specialty,
            hourly_rate: trainerDetails?.hourly_rate,
            is_online: onlineStatus?.[0]?.is_online || false,
            last_seen: onlineStatus?.[0]?.last_seen,
          });
        }
      } else if (connection.trainer_id === userId) {
        // Current user is the trainer, so the other person is the user
        const otherUserId = connection.user_id;
        
        // Get the user's profile information
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', otherUserId)
          .single();

        // Get online status
        const { data: onlineStatus } = await supabase
          .rpc('get_user_online_status', { p_user_id: otherUserId });

        if (userProfile) {
          connectedUsers.push({
            id: otherUserId,
            name: userProfile.full_name || userProfile.username || 'Unknown User',
            type: 'user',
            avatar_url: userProfile.avatar_url,
            is_online: onlineStatus?.[0]?.is_online || false,
            last_seen: onlineStatus?.[0]?.last_seen,
          });
        }
      }
    }

    return connectedUsers;
  } catch (error) {
    console.error('Error getting connected users:', error);
    return [];
  }
};

// Start a new conversation with a connected user
export const startNewConversation = async (
  userId: string,
  userType: 'user' | 'trainer',
  otherUserId: string,
  otherUserType: 'user' | 'trainer',
  initialMessage?: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> => {
  try {
    // Check if conversation already exists
    const existingConversation = await getConversationByParticipants(userId, otherUserId);
    if (existingConversation) {
      return {
        success: true,
        conversationId: existingConversation.id
      };
    }

    // Create new conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: userId,
        participant_1_type: userType,
        participant_2_id: otherUserId,
        participant_2_type: otherUserType,
        last_message_time: new Date().toISOString()
      })
      .select()
      .single();

    if (convError) throw convError;

    // Send initial message if provided
    if (initialMessage && conversation) {
      await sendMessage(
        conversation.id,
        userId,
        otherUserId,
        initialMessage,
        'text'
      );
    }

    return {
      success: true,
      conversationId: conversation.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start conversation'
    };
  }
};
