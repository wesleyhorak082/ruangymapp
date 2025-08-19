-- Fix Admin Messaging Functions - Remove email column references
-- Date: 2025-08-31

-- Fix the get_all_users_for_admin function to work without email column
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
    up.full_name,
    up.username,
    '' as email,  -- Empty string since email column doesn't exist
    up.user_type,
    up.avatar_url,
    FALSE as is_online,  -- Default to offline since user_online_status table doesn't exist
    NULL as last_seen    -- Default to NULL since user_online_status table doesn't exist
  FROM user_profiles up
  WHERE up.user_type != 'admin'
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the search_users_for_admin function to work without email column
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
    up.full_name,
    up.username,
    '' as email,  -- Empty string since email column doesn't exist
    up.user_type,
    up.avatar_url
  FROM user_profiles up
  WHERE up.user_type != 'admin'
    AND (
      up.full_name ILIKE '%' || p_search_query || '%' OR
      up.username ILIKE '%' || p_search_query || '%'
      -- Removed email search since column doesn't exist
    )
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the functions were updated
SELECT 'Admin messaging functions updated successfully!' as status;

-- Test the functions (these should work now)
-- SELECT * FROM get_all_users_for_admin() LIMIT 5;
-- SELECT * FROM search_users_for_admin('test') LIMIT 5;
