-- Migration: Admin System and Shop
-- This migration creates the admin system, shop functionality, and subscription management

-- Create admin_profiles table
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shop_products table
CREATE TABLE IF NOT EXISTS shop_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    monthly_fee DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trainer_programs table for storing custom workout programs created by trainers
CREATE TABLE IF NOT EXISTS trainer_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    duration TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Strength', 'Cardio', 'Flexibility', 'Mixed', 'Custom')),
    workout_days JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_program_assignments table for assigning trainer programs to users
CREATE TABLE IF NOT EXISTS user_program_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES trainer_programs(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, program_id)
);

-- Add subscription_end and is_blocked to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_end DATE,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Add location fields to trainer_profiles
ALTER TABLE trainer_profiles
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_profiles_email ON admin_profiles(email);
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_blocked ON user_profiles(is_blocked);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_end);
CREATE INDEX IF NOT EXISTS idx_trainer_programs_trainer_id ON trainer_programs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_programs_active ON trainer_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_user_id ON user_program_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_program_id ON user_program_assignments(program_id);

-- Set up Row Level Security (RLS)
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_profiles
CREATE POLICY "Admins can view all admin profiles" ON admin_profiles
    FOR SELECT USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admins can insert admin profiles" ON admin_profiles
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admin_profiles WHERE role = 'super_admin'));

CREATE POLICY "Admins can update admin profiles" ON admin_profiles
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin_profiles));

-- RLS Policies for shop_products
CREATE POLICY "Anyone can view active shop products" ON shop_products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all shop products" ON shop_products
    FOR SELECT USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admins can insert shop products" ON shop_products
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admins can update shop products" ON shop_products
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin_profiles));

CREATE POLICY "Admins can delete shop products" ON shop_products
    FOR DELETE USING (auth.uid() IN (SELECT id FROM admin_profiles));

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for trainer_programs
CREATE POLICY "Trainers can manage their own programs" ON trainer_programs
    FOR ALL USING (auth.uid() = trainer_id);

CREATE POLICY "Users can view active trainer programs" ON trainer_programs
    FOR SELECT USING (is_active = true);

-- RLS Policies for user_program_assignments
CREATE POLICY "Users can view their own program assignments" ON user_program_assignments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view assignments to their programs" ON user_program_assignments
    FOR SELECT USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can assign programs to users" ON user_program_assignments
    FOR INSERT WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update assignments to their programs" ON user_program_assignments
    FOR UPDATE USING (auth.uid() = trainer_id);

-- Create function to handle trainer program assignment
CREATE OR REPLACE FUNCTION assign_trainer_program_to_user(
    p_user_id UUID,
    p_program_id UUID,
    p_trainer_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Check if the trainer owns the program
    IF NOT EXISTS (
        SELECT 1 FROM trainer_programs 
        WHERE id = p_program_id AND trainer_id = p_trainer_id AND is_active = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Program not found or not owned by trainer'
        );
    END IF;

    -- Check if user is connected to trainer
    IF NOT EXISTS (
        SELECT 1 FROM connection_requests 
        WHERE user_id = p_user_id AND trainer_id = p_trainer_id AND status = 'approved'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User is not connected to this trainer'
        );
    END IF;

    -- Insert or update assignment
    INSERT INTO user_program_assignments (user_id, trainer_id, program_id)
    VALUES (p_user_id, p_trainer_id, p_program_id)
    ON CONFLICT (user_id, program_id) 
    DO UPDATE SET 
        trainer_id = p_trainer_id,
        assigned_at = NOW(),
        is_active = true;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Program assigned successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION assign_trainer_program_to_user(UUID, UUID, UUID) TO authenticated;

-- Insert the default admin user (Ruan Kemp) - only if user exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'ruansgym@gmail.com') THEN
        INSERT INTO admin_profiles (id, email, username, full_name, role)
        VALUES (
            (SELECT id FROM auth.users WHERE email = 'ruansgym@gmail.com' LIMIT 1),
            'ruansgym@gmail.com',
            'Ruan',
            'Ruan Kemp',
            'admin'
        ) ON CONFLICT (email) DO UPDATE SET
            username = EXCLUDED.username,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE admin_profiles IS 'Administrative user profiles with role-based permissions';
COMMENT ON TABLE shop_products IS 'Products available for purchase in the gym shop';
COMMENT ON TABLE user_subscriptions IS 'User subscription plans and payment tracking';
COMMENT ON COLUMN user_profiles.subscription_end IS 'Date when the user''s subscription expires';
COMMENT ON COLUMN user_profiles.is_blocked IS 'Whether the user account is blocked by admin';
