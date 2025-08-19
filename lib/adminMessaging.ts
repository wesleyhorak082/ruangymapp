import { supabase } from './supabase';

export interface AdminMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system' | 'admin';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  is_admin_message: boolean;
}

export interface AdminConversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  participant_1_type: 'user' | 'trainer' | 'admin';
  participant_2_type: 'user' | 'trainer' | 'admin';
  last_message_id?: string;
  last_message_time: string;
  unread_count_participant_1: number;
  unread_count_participant_2: number;
  created_at: string;
  updated_at: string;
}

export interface AdminConversationWithParticipant extends AdminConversation {
  other_participant: {
    id: string;
    name: string;
    type: 'user' | 'trainer' | 'admin';
    avatar_url?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
    is_admin_message: boolean;
  };
}

// Get all users and trainers for admin messaging
export const getAllUsersForAdmin = async (): Promise<{
  id: string;
  name: string;
  type: 'user' | 'trainer';
  avatar_url?: string;
  email?: string;
  username?: string;
  is_online?: boolean;
  last_seen?: string;
}[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_all_users_for_admin');

    if (error) throw error;

    return data.map((user: any) => ({
      id: user.user_id,
      name: user.full_name || user.username || 'Unknown User',
      type: user.user_type as 'user' | 'trainer',
      avatar_url: user.avatar_url,
      email: user.email,
      username: user.username,
      is_online: user.is_online || false,
      last_seen: user.last_seen,
    }));
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    return [];
  }
};

// Get or create admin conversation with any user/trainer
export const getOrCreateAdminConversation = async (
  adminId: string,
  targetUserId: string,
  targetUserType: 'user' | 'trainer'
): Promise<string | null> => {
  try {
    // Check if conversation already exists
    const { data: existingConversation, error: checkError } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1_id.eq.${adminId},participant_2_id.eq.${targetUserId}),and(participant_1_id.eq.${targetUserId},participant_2_id.eq.${adminId})`)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingConversation) {
      return existingConversation.id;
    }

    // Create new admin conversation
    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: adminId,
        participant_1_type: 'admin',
        participant_2_id: targetUserId,
        participant_2_type: targetUserType,
        last_message_time: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError) throw createError;
    return newConversation.id;
  } catch (error) {
    console.error('Error creating admin conversation:', error);
    return null;
  }
};

// Send admin message (bypasses privacy settings)
export const sendAdminMessage = async (
  conversationId: string,
  adminId: string,
  receiverId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'system' | 'admin' = 'text' // Changed default from 'admin' to 'text'
): Promise<{ success: boolean; message?: AdminMessage; error?: string }> => {
  try {
    // Use the database function instead of direct table insertion
    const { data: messageId, error: rpcError } = await supabase.rpc('send_admin_message', {
      p_conversation_id: conversationId,
      p_admin_id: adminId,
      p_receiver_id: receiverId,
      p_content: content,
      p_message_type: messageType
    });

    if (rpcError) throw rpcError;

    // Fetch the created message
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    // Create notification for the receiver about the admin message
    try {
      await supabase.rpc('create_notification', {
        p_user_id: receiverId,
        p_type: 'admin_message',
        p_title: 'Admin Message',
        p_message: `You have received an important message from admin: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        p_data: { 
          conversation_id: conversationId,
          sender_id: adminId,
          message_id: message.id,
          message_preview: content.substring(0, 100),
          is_admin_message: true
        }
      });
    } catch (notificationError) {
      console.log('⚠️ Could not create notification for admin message:', notificationError);
    }

    return {
      success: true,
      message: message as AdminMessage
    };
  } catch (error) {
    console.error('Admin message error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send admin message'
    };
  }
};

// Get admin conversations
export const getAdminConversations = async (adminId: string): Promise<AdminConversationWithParticipant[]> => {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(
          id,
          content,
          sender_id,
          created_at,
          is_admin_message
        )
      `)
      .or(`participant_1_id.eq.${adminId},participant_2_id.eq.${adminId}`)
      .order('last_message_time', { ascending: false });

    if (error) throw error;

    // Transform conversations to include participant info
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipantId = conv.participant_1_id === adminId 
          ? conv.participant_2_id 
          : conv.participant_1_id;
        
        const otherParticipantType = conv.participant_1_id === adminId 
          ? conv.participant_2_type 
          : conv.participant_1_type;

        // Get participant profile info
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
            type: otherParticipantType as 'user' | 'trainer' | 'admin',
            avatar_url: profile?.avatar_url
          },
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at,
            is_admin_message: lastMessage.is_admin_message || false
          } : undefined
        };
      })
    );

    return conversationsWithParticipants;
  } catch (error) {
    console.error('Error fetching admin conversations:', error);
    return [];
  }
};

// Get admin conversation messages
export const getAdminConversationMessages = async (conversationId: string): Promise<AdminMessage[]> => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return messages as AdminMessage[];
  } catch (error) {
    console.error('Error fetching admin conversation messages:', error);
    return [];
  }
};

// Search users for admin messaging
export const searchUsersForAdmin = async (query: string): Promise<{
  id: string;
  name: string;
  type: 'user' | 'trainer';
  avatar_url?: string;
  email?: string;
  username?: string;
}[]> => {
  try {
    const { data, error } = await supabase
      .rpc('search_users_for_admin', { p_search_query: query });

    if (error) throw error;

    return data.map((user: any) => ({
      id: user.user_id,
      name: user.full_name || user.username || 'Unknown User',
      type: user.user_type as 'user' | 'trainer',
      avatar_url: user.avatar_url,
      email: user.email,
      username: user.username,
    }));
  } catch (error) {
    console.error('Error searching users for admin:', error);
    return [];
  }
};

// Get unread admin message count
export const getAdminUnreadMessageCount = async (adminId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', adminId)
      .eq('is_read', false);

    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('Error getting admin unread count:', error);
    return 0;
  }
};

// Mark admin messages as read
export const markAdminMessagesAsRead = async (conversationId: string, adminId: string): Promise<void> => {
  try {
    await supabase
      .rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: adminId
      });
  } catch (error) {
    console.error('Error marking admin messages as read:', error);
  }
};
