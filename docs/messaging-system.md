# Messaging System Documentation

## Overview

The RuangGym app now includes a comprehensive messaging system that allows trainers and clients to communicate seamlessly. The system is built with real-time capabilities, secure messaging, and an intuitive user interface.

## Features

### 🚀 **Core Functionality**
- **Real-time Messaging**: Instant message delivery between users
- **Conversation Management**: Organized chat threads for each user pair
- **Unread Message Tracking**: Visual indicators for new messages
- **Message Search**: Find specific conversations quickly
- **Role-based Access**: Different interfaces for trainers and clients

### 💬 **User Experience**
- **Unified Messages Tab**: Central hub for all conversations
- **Quick Message Modal**: Trainers can send quick messages from client dashboard
- **Chat Interface**: Modern, responsive chat UI similar to popular messaging apps
- **Online Status**: Visual indicators for user availability
- **Message History**: Persistent conversation storage

### 🔒 **Security & Privacy**
- **Row Level Security (RLS)**: Users can only access their own conversations
- **Message Encryption**: Secure message transmission
- **User Authentication**: Verified user access to messaging features
- **Data Privacy**: Messages are private between participants

## Architecture

### Database Schema

#### `conversations` Table
```sql
- id: UUID (Primary Key)
- participant_1_id: UUID (Foreign Key to auth.users)
- participant_2_id: UUID (Foreign Key to auth.users)
- participant_1_type: TEXT ('trainer' | 'client')
- participant_2_type: TEXT ('trainer' | 'client')
- last_message_id: UUID (Foreign Key to messages)
- last_message_time: TIMESTAMP
- unread_count_participant_1: INTEGER
- unread_count_participant_2: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `messages` Table
```sql
- id: UUID (Primary Key)
- conversation_id: UUID (Foreign Key to conversations)
- sender_id: UUID (Foreign Key to auth.users)
- receiver_id: UUID (Foreign Key to auth.users)
- content: TEXT
- message_type: TEXT ('text' | 'image' | 'file')
- is_read: BOOLEAN
- read_at: TIMESTAMP
- created_at: TIMESTAMP
```

### API Functions

#### Core Messaging Functions
- `getUserConversations(userId)`: Fetch all conversations for a user
- `getConversationMessages(conversationId, userId)`: Get messages for a conversation
- `sendMessage(conversationId, senderId, receiverId, content, type)`: Send a new message
- `getOrCreateConversation(p1Id, p2Id, p1Type, p2Type)`: Create or get existing conversation
- `markMessagesAsRead(conversationId, userId)`: Mark messages as read
- `searchConversations(userId, query)`: Search conversations by participant name

#### Helper Functions
- `getUnreadMessageCount(userId)`: Get total unread messages for a user
- `deleteMessage(messageId, userId)`: Delete a message (sender only)
- `getConversationByParticipants(p1Id, p2Id)`: Find conversation between two users

## User Flows

### For Trainers

#### Starting a Conversation
1. **From Client Dashboard**: Click "Message" button on any client card
2. **Quick Message Modal**: Type and send a quick message
3. **Automatic Conversation Creation**: System creates conversation if none exists
4. **Redirect to Messages Tab**: Continue conversation in full messaging interface

#### Managing Client Communications
1. **Messages Tab**: View all client conversations
2. **Search Conversations**: Find specific clients quickly
3. **Unread Indicators**: See which clients have new messages
4. **Message History**: Access complete conversation history

### For Clients

#### Connecting with Trainers
1. **Find Trainer**: Use Trainer Discovery to find suitable trainers
2. **Request Connection**: Send connection request with goals and message
3. **Approval Process**: Wait for trainer to approve connection
4. **Start Messaging**: Begin conversation once connected

#### Managing Trainer Communications
1. **Messages Tab**: View all trainer conversations
2. **My Trainers**: See connected trainers and their status
3. **Quick Actions**: Message, book sessions, view programs
4. **Connection Management**: Disconnect from trainers if needed

## Technical Implementation

### Frontend Components

#### Messages Tab (`/(tabs)/messages.tsx`)
- **Conversation List**: Shows all active conversations
- **Chat Interface**: Full-featured messaging UI
- **Search Functionality**: Find conversations quickly
- **Real-time Updates**: Live message delivery

#### Quick Message Component (`components/QuickMessage.tsx`)
- **Modal Interface**: Overlay for quick messages
- **Message Input**: Text input with send functionality
- **Auto-conversation**: Creates conversations automatically
- **Error Handling**: User feedback for failed messages

#### Integration Points
- **Client Dashboard**: Quick message buttons for each client
- **My Trainers**: Message buttons for connected trainers
- **Navigation**: Seamless flow between screens

### Backend Services

#### Database Functions
- **Automatic Triggers**: Update conversation metadata on message send
- **Unread Count Management**: Track unread messages per user
- **Conversation Creation**: Prevent duplicate conversations
- **Message Cleanup**: Optional message retention policies

#### Security Policies
- **User Isolation**: Users can only see their own conversations
- **Message Validation**: Ensure users can only send to valid conversations
- **Role-based Access**: Different permissions for trainers vs clients

## Setup & Configuration

### Database Migration
```bash
# Run the messaging system migration
supabase db push
```

### Environment Variables
```env
# Ensure these are set in your Supabase project
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

### Component Registration
```tsx
// Add Messages tab to tab layout
<Tabs.Screen
  name="messages"
  options={{
    title: 'Messages',
    tabBarIcon: ({ size, color }) => (
      <MessageCircle size={size} color={color} />
    ),
  }}
/>
```

## Usage Examples

### Sending a Quick Message (Trainer)
```tsx
// In Client Dashboard
<TouchableOpacity
  onPress={() => {
    setSelectedClient(client);
    setShowQuickMessageModal(true);
  }}
>
  <MessageCircle size={16} color="#6C5CE7" />
  <Text>Message</Text>
</TouchableOpacity>
```

### Fetching Conversations
```tsx
// In Messages Tab
const conversations = await getUserConversations(userId);
const transformedConversations = conversations.map(conv => ({
  id: conv.id,
  participant_name: conv.other_participant_name,
  last_message: conv.last_message_content,
  unread_count: conv.unread_count,
}));
```

### Sending a Message
```tsx
// Send message via API
const message = await sendMessage(
  conversationId,
  senderId,
  receiverId,
  messageContent,
  'text'
);
```

## Future Enhancements

### Planned Features
- **Push Notifications**: Alert users of new messages
- **File Attachments**: Support for images, documents, workout plans
- **Voice Messages**: Audio message support
- **Message Reactions**: Emoji reactions to messages
- **Group Conversations**: Multi-participant chats
- **Message Encryption**: End-to-end encryption
- **Read Receipts**: Delivery and read status tracking

### Performance Optimizations
- **Message Pagination**: Load messages in chunks
- **Real-time Sync**: WebSocket integration for live updates
- **Offline Support**: Message queuing when offline
- **Image Optimization**: Compressed image uploads
- **Search Indexing**: Fast conversation search

## Troubleshooting

### Common Issues

#### Messages Not Sending
- Check user authentication status
- Verify conversation exists
- Ensure proper user permissions
- Check network connectivity

#### Conversations Not Loading
- Verify user ID is valid
- Check database connection
- Ensure RLS policies are correct
- Verify user role permissions

#### Search Not Working
- Check search query length
- Verify user has conversations
- Ensure search function is properly imported
- Check for API rate limiting

### Debug Mode
```tsx
// Enable debug logging
console.log('User ID:', userId);
console.log('Conversations:', conversations);
console.log('Messages:', messages);
```

## Support & Maintenance

### Monitoring
- **Message Delivery**: Track successful/failed message sends
- **User Activity**: Monitor messaging engagement
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Log and alert on failures

### Updates
- **Regular Backups**: Database backup procedures
- **Schema Updates**: Migration management
- **API Versioning**: Backward compatibility
- **Security Patches**: Regular security updates

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: Development Team
