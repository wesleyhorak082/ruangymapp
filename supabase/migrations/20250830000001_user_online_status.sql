-- Add last_seen column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create user_online_status table for real-time status
CREATE TABLE IF NOT EXISTS user_online_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_online_status_user_id ON user_online_status(user_id);

-- Create index on is_online for quick queries
CREATE INDEX IF NOT EXISTS idx_user_online_status_online ON user_online_status(is_online);

-- Enable Row Level Security
ALTER TABLE user_online_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view online status of all users" ON user_online_status
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own online status" ON user_online_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own online status" ON user_online_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update user online status
CREATE OR REPLACE FUNCTION update_user_online_status(
  p_user_id UUID,
  p_is_online BOOLEAN
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_online_status (user_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, p_is_online, NOW(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    is_online = EXCLUDED.is_online,
    last_seen = EXCLUDED.last_seen,
    updated_at = EXCLUDED.updated_at;
    
  -- Also update user_profiles last_seen
  UPDATE user_profiles 
  SET last_seen = NOW() 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get online status
CREATE OR REPLACE FUNCTION get_user_online_status(p_user_id UUID)
RETURNS TABLE(
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uos.is_online, false) as is_online,
    COALESCE(uos.last_seen, up.last_seen) as last_seen
  FROM user_profiles up
  LEFT JOIN user_online_status uos ON up.id = uos.user_id
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_online_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_online_status(UUID) TO authenticated;
