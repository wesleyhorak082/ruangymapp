-- Final Fix for Admin Messaging Functions - Match actual table structure
-- Date: 2025-08-31

-- First, let's check what columns actually exist in user_profiles
-- Run this to see your table structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles' ORDER BY ordinal_position;

-- Fix the get_all_users_for_admin function to match actual table structure
CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  email TEXT,
  user_type TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as user_id,
    COALESCE(up.full_name, '') as full_name,
    COALESCE(up.username, '') as username,
    '' as email,  -- Empty string since email column doesn't exist
    COALESCE(up.user_type, 'user') as user_type,
    COALESCE(up.avatar_url, '') as avatar_url,
    FALSE as is_online,  -- Default to offline since user_online_status table doesn't exist
    NOW() as last_seen    -- Use current timestamp instead of NULL
  FROM user_profiles up
  WHERE up.user_type != 'admin'
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the search_users_for_admin function to match actual table structure
CREATE OR REPLACE FUNCTION search_users_for_admin(p_search_query TEXT)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  email TEXT,
  user_type TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as user_id,
    COALESCE(up.full_name, '') as full_name,
    COALESCE(up.username, '') as username,
    '' as email,  -- Empty string since email column doesn't exist
    COALESCE(up.user_type, 'user') as user_type,
    COALESCE(up.avatar_url, '') as avatar_url
  FROM user_profiles up
  WHERE up.user_type != 'admin'
    AND (
      COALESCE(up.full_name, '') ILIKE '%' || p_search_query || '%' OR
      COALESCE(up.username, '') ILIKE '%' || p_search_query || '%'
    )
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the functions were updated
SELECT 'Admin messaging functions updated successfully!' as status;

-- Test the functions (these should work now)
-- SELECT * FROM get_all_users_for_admin() LIMIT 5;
-- SELECT * FROM search_users_for_admin('test') LIMIT 5;
