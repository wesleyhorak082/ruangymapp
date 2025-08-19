# 🗄️ Database Setup Guide - Messaging System

This guide will help you set up the complete database infrastructure for the enhanced messaging system in your Ruang Gym app.

## 📋 Prerequisites

1. **Supabase Project**: You need a Supabase project with admin access
2. **Service Role Key**: You need the service role key (not the anon key) for running migrations
3. **Environment Variables**: Set up your `.env` file

## 🔧 Environment Setup

Create or update your `.env` file with:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important**: The `SUPABASE_SERVICE_ROLE_KEY` is different from the anon key and has admin privileges.

## 🚀 Running Migrations

### Option 1: Using the Migration Script (Recommended)

1. **Install dependencies** (if not already installed):
   ```bash
   npm install @supabase/supabase-js dotenv
   ```

2. **Run the migration script**:
   ```bash
   node scripts/run-migrations.js
   ```

### Option 2: Manual Migration via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - `20250817000000_messaging_system.sql`
   - `20250818000000_enhanced_messaging_features.sql`

## 📊 Database Schema Overview

### Core Tables

#### 1. `conversations`
- Stores chat conversations between users and trainers
- Tracks unread message counts for each participant
- Maintains last message information for sorting

#### 2. `messages`
- Stores individual messages within conversations
- Supports text, image, and file message types
- Tracks delivery status and read receipts

### Enhanced Features Tables

#### 3. `message_reactions`
- Stores user reactions to messages (like, love, laugh, etc.)
- Prevents duplicate reactions from the same user

#### 4. `push_notification_tokens`
- Stores device tokens for push notifications
- Supports multiple platforms (iOS, Android, Web)

#### 5. `notification_preferences`
- User preferences for different notification types
- Granular control over what notifications to receive

#### 6. `message_attachments`
- Manages file attachments for messages
- Stores metadata like file size, type, and thumbnails

## 🔐 Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their own conversations and messages
- Secure by default - no data leakage between users

### Policies
- **Conversations**: Users can only view conversations they participate in
- **Messages**: Users can only view messages in their conversations
- **Reactions**: Users can only react to messages they can see
- **Preferences**: Users can only manage their own notification settings

## ⚡ Performance Features

### Indexes
- Optimized queries for conversation listing
- Fast message retrieval by conversation
- Efficient unread count calculations

### Functions
- **`get_or_create_conversation`**: Automatically creates conversations
- **`update_conversation_last_message`**: Updates conversation metadata
- **`mark_messages_as_read`**: Batch updates message read status
- **`toggle_message_reaction`**: Handles reaction toggling

## 🧪 Testing the Setup

### 1. Verify Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages', 'message_reactions');
```

### 2. Test Basic Functions
```sql
-- Test conversation creation
SELECT get_or_create_conversation(
  'user-uuid-1', 'user', 
  'trainer-uuid-1', 'trainer'
);

-- Test message insertion
INSERT INTO messages (conversation_id, sender_id, receiver_id, content)
VALUES ('conversation-uuid', 'user-uuid-1', 'trainer-uuid-1', 'Hello!');
```

### 3. Check RLS Policies
```sql
-- Verify policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('conversations', 'messages');
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Permission denied" errors
- **Cause**: Missing service role key or insufficient permissions
- **Solution**: Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

#### 2. "Function does not exist" errors
- **Cause**: Migrations didn't run completely
- **Solution**: Re-run migrations in order

#### 3. RLS policy errors
- **Cause**: Policies not created properly
- **Solution**: Check if all migration steps completed

### Debug Steps

1. **Check migration logs** in the script output
2. **Verify table creation** in Supabase dashboard
3. **Test basic queries** with service role key
4. **Check RLS policies** are properly applied

## 🔄 Updating Existing Data

If you have existing data that needs migration:

1. **Backup your data** before running migrations
2. **Run migrations in order** to avoid conflicts
3. **Test with a small dataset** first
4. **Verify data integrity** after migration

## 📱 Integration with App

Once migrations are complete:

1. **Update your app** to use the new API functions
2. **Test messaging features** with real data
3. **Verify push notifications** work correctly
4. **Check file uploads** function properly

## 🎯 Next Steps

After successful database setup:

1. **Test the messaging system** with real users
2. **Implement push notifications** using the token system
3. **Add file upload functionality** for attachments
4. **Monitor performance** and optimize as needed

## 📞 Support

If you encounter issues:

1. **Check the logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Test with Supabase dashboard** to isolate issues
4. **Review migration files** for syntax errors

---

**Happy coding! 🚀** Your enhanced messaging system is now ready to power real-time communication in your Ruang Gym app.
