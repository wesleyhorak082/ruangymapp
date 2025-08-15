-- Migration: Add User Profiles with Emails Function
-- Date: 2025-08-21
-- Description: Creates a function to fetch user profiles with their email addresses

-- Drop the function if it exists to recreate it
DROP FUNCTION IF EXISTS get_user_profiles_with_emails();

-- Create function to get user profiles with emails
CREATE OR REPLACE FUNCTION get_user_profiles_with_emails()
RETURNS TABLE (
    id uuid,
    username text,
    full_name text,
    avatar_url text,
    user_type text,
    email character varying(255),
    phone text,
    goals text[],
    created_at timestamptz,
    updated_at timestamptz
) AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Loop through user profiles and get emails individually to avoid relationship conflicts
    FOR user_record IN 
        SELECT up.* FROM user_profiles up WHERE up.user_type = 'user'
    LOOP
        id := user_record.id;
        username := COALESCE(user_record.username, '')::text;
        full_name := COALESCE(user_record.full_name, '')::text;
        avatar_url := COALESCE(user_record.avatar_url, '')::text;
        user_type := COALESCE(user_record.user_type, '')::text;
        phone := COALESCE(user_record.phone, '')::text;
        goals := COALESCE(user_record.goals, ARRAY[]::text[]);
        created_at := user_record.created_at;
        updated_at := user_record.updated_at;
        
        -- Get email from auth.users table
        SELECT email INTO email FROM auth.users WHERE id = user_record.id;
        email := COALESCE(email, '')::character varying(255);
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profiles_with_emails() TO authenticated;
