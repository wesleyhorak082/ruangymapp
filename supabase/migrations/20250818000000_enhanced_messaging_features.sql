-- Migration: Enhanced Messaging Features
-- Date: 2025-08-18
-- Description: Adds advanced messaging features including file attachments, reactions, delivery status, and push notifications

-- Add new columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry', 'clap', 'fire', 'flex', 'thinking', 'party', 'smile')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction_type)
);

-- Create push_notification_tokens table
CREATE TABLE IF NOT EXISTS push_notification_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    new_messages BOOLEAN DEFAULT TRUE,
    message_reactions BOOLEAN DEFAULT TRUE,
    trainer_requests BOOLEAN DEFAULT TRUE,
    workout_updates BOOLEAN DEFAULT TRUE,
    session_reminders BOOLEAN DEFAULT TRUE,
    achievements BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_attachments table for better file management
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    thumbnail_url TEXT,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for new tables and columns
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_notification_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- Create function to update message delivery status
CREATE OR REPLACE FUNCTION update_message_delivery_status(
    p_message_id UUID,
    p_status TEXT,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE messages 
    SET 
        delivery_status = p_status,
        delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END
    WHERE id = p_message_id AND receiver_id = p_user_id;
    
    -- If status is 'read', also mark as read
    IF p_status = 'read' THEN
        UPDATE messages 
        SET 
            is_read = TRUE,
            read_at = NOW()
        WHERE id = p_message_id AND receiver_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get message reactions summary
CREATE OR REPLACE FUNCTION get_message_reactions_summary(p_message_id UUID)
RETURNS TABLE(reaction_type TEXT, count BIGINT, users UUID[]) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.reaction_type,
        COUNT(*)::BIGINT,
        ARRAY_AGG(mr.user_id)
    FROM message_reactions mr
    WHERE mr.message_id = p_message_id
    GROUP BY mr.reaction_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to toggle message reaction
CREATE OR REPLACE FUNCTION toggle_message_reaction(
    p_message_id UUID,
    p_user_id UUID,
    p_reaction_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if reaction already exists
    SELECT EXISTS(
        SELECT 1 FROM message_reactions 
        WHERE message_id = p_message_id 
        AND user_id = p_user_id 
        AND reaction_type = p_reaction_type
    ) INTO v_exists;
    
    IF v_exists THEN
        -- Remove existing reaction
        DELETE FROM message_reactions 
        WHERE message_id = p_message_id 
        AND user_id = p_user_id 
        AND reaction_type = p_reaction_type;
        RETURN FALSE;
    ELSE
        -- Add new reaction
        INSERT INTO message_reactions (message_id, user_id, reaction_type)
        VALUES (p_message_id, p_user_id, p_reaction_type);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get unread message count with delivery status
CREATE OR REPLACE FUNCTION get_unread_message_count_with_status(p_user_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT, last_message_time TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        COUNT(m.id)::BIGINT,
        MAX(m.created_at)
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id 
        AND m.receiver_id = p_user_id 
        AND m.is_read = FALSE
    WHERE c.participant_1_id = p_user_id OR c.participant_2_id = p_user_id
    GROUP BY c.id
    HAVING COUNT(m.id) > 0;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view reactions on messages in their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to messages in their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can manage their own notification tokens" ON push_notification_tokens;
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON message_attachments;
DROP POLICY IF EXISTS "Users can insert attachments to their messages" ON message_attachments;

-- Create RLS policies for message_reactions
CREATE POLICY "Users can view reactions on messages in their conversations" ON message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.id = message_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can add reactions to messages in their conversations" ON message_reactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.id = message_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can remove their own reactions" ON message_reactions
    FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for push_notification_tokens
CREATE POLICY "Users can manage their own notification tokens" ON push_notification_tokens
    FOR ALL USING (user_id = auth.uid());

-- Create RLS policies for notification_preferences
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Create RLS policies for message_attachments
CREATE POLICY "Users can view attachments in their conversations" ON message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.id = message_id 
            AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert attachments to their messages" ON message_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = message_id AND m.sender_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON message_reactions TO authenticated;
GRANT ALL ON push_notification_tokens TO authenticated;
GRANT ALL ON notification_preferences TO authenticated;
GRANT ALL ON message_attachments TO authenticated;

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_push_tokens_updated_at ON push_notification_tokens;
DROP TRIGGER IF EXISTS trigger_update_notification_prefs_updated_at ON notification_preferences;

CREATE TRIGGER trigger_update_push_tokens_updated_at
    BEFORE UPDATE ON push_notification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_notification_prefs_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
