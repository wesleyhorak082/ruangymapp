# Database Migration Troubleshooting Guide

## Current System Analysis

**Database Platform:** PostgreSQL (Supabase)
**Migration Tool:** Supabase CLI / Dashboard
**Project Type:** React Native Expo with Supabase backend

## 1. Immediate Diagnosis Steps

### Check Migration Status
```sql
-- Check which migrations have been applied
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;

-- Check for any failed migration entries
SELECT * FROM supabase_migrations.schema_migrations 
WHERE dirty = true;
```

### Verify Current Schema State
```sql
-- List all tables and their structure
SELECT 
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check for any incomplete table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### Check RLS Policies
```sql
-- Verify Row Level Security policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public';
```

### Check Triggers and Functions
```sql
-- List all triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- List custom functions
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public';
```

## 2. Common Migration Failure Scenarios

### Scenario A: Partial Migration Application
**Symptoms:**
- Some tables exist, others don't
- Missing columns in existing tables
- RLS policies not applied

**Diagnosis:**
```sql
-- Check if expected tables exist
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
);

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'trainer_profiles'
);

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_measurements'
);

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_workouts'
);
```

### Scenario B: Constraint Violations
**Symptoms:**
- Migration fails with foreign key errors
- Unique constraint violations
- Data type mismatches

**Diagnosis:**
```sql
-- Check for constraint violations
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
```

### Scenario C: Permission Issues
**Symptoms:**
- RLS policies not working
- Users can't access data
- Authentication issues

**Diagnosis:**
```sql
-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public';

-- Verify auth schema exists
SELECT EXISTS (
    SELECT FROM information_schema.schemata 
    WHERE schema_name = 'auth'
);
```

## 3. Step-by-Step Resolution Plan

### Phase 1: Safety Backup
```bash
# Create a backup before any changes
# In Supabase Dashboard: Settings > Database > Backups
# Or using pg_dump if you have direct access
```

### Phase 2: Rollback Procedure (if needed)
```sql
-- If migration needs to be rolled back
-- This depends on the specific migration content

-- Example rollback for table creation:
DROP TABLE IF EXISTS user_workouts CASCADE;
DROP TABLE IF EXISTS user_measurements CASCADE;
DROP TABLE IF EXISTS trainer_profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Remove migration entry
DELETE FROM supabase_migrations.schema_migrations 
WHERE version = 'problematic_migration_version';
```

### Phase 3: Clean Migration Reapplication

#### Step 1: Verify Prerequisites
```sql
-- Ensure auth schema exists
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- Check for required extensions
SELECT extname FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto');
```

#### Step 2: Apply Migration Manually (if needed)
Based on your current schema, here's what should exist:

```sql
-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_type text DEFAULT 'user' CHECK (user_type IN ('user', 'trainer'))
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read other profiles" ON user_profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Create trainer_profiles table
CREATE TABLE IF NOT EXISTS trainer_profiles (
    id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    specialty text NOT NULL,
    bio text,
    hourly_rate integer DEFAULT 50 NOT NULL,
    rating numeric(3,2) DEFAULT 5.0,
    availability jsonb DEFAULT '[]',
    experience_years integer DEFAULT 1,
    certifications text[] DEFAULT '{}',
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for trainer_profiles
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for trainer_profiles
CREATE POLICY "Trainers can manage own profile" ON trainer_profiles
    FOR ALL TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can read trainer profiles" ON trainer_profiles
    FOR SELECT TO authenticated USING (is_available = true);

-- Create user_measurements table
CREATE TABLE IF NOT EXISTS user_measurements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    measurement_name text NOT NULL,
    current_value text NOT NULL,
    previous_value text DEFAULT '-',
    change_value text DEFAULT 'New',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for user_measurements
ALTER TABLE user_measurements ENABLE ROW LEVEL SECURITY;

-- Create policy for user_measurements
CREATE POLICY "Users can manage own measurements" ON user_measurements
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create user_workouts table
CREATE TABLE IF NOT EXISTS user_workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    exercises jsonb DEFAULT '[]',
    duration integer DEFAULT 0,
    completed boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for user_workouts
ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;

-- Create policy for user_workouts
CREATE POLICY "Users can manage own workouts" ON user_workouts
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainer_profiles_updated_at
    BEFORE UPDATE ON trainer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_measurements_updated_at
    BEFORE UPDATE ON user_measurements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create user creation trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'user')
    );
    
    -- If user is a trainer, create trainer profile
    IF NEW.raw_user_meta_data->>'user_type' = 'trainer' THEN
        INSERT INTO public.trainer_profiles (
            id,
            specialty,
            bio,
            hourly_rate,
            experience_years,
            certifications
        ) VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'trainer_info'->>'specialty',
            NEW.raw_user_meta_data->>'trainer_info'->>'bio',
            COALESCE((NEW.raw_user_meta_data->>'trainer_info'->>'hourlyRate')::integer, 50),
            COALESCE((NEW.raw_user_meta_data->>'trainer_info'->>'experienceYears')::integer, 1),
            CASE 
                WHEN NEW.raw_user_meta_data->>'trainer_info'->>'certifications' IS NOT NULL 
                THEN string_to_array(NEW.raw_user_meta_data->>'trainer_info'->>'certifications', ',')
                ELSE '{}'::text[]
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### Step 3: Verification
```sql
-- Verify all tables exist with correct structure
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN ('user_profiles', 'trainer_profiles', 'user_measurements', 'user_workouts')
GROUP BY t.table_name
ORDER BY t.table_name;

-- Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'trainer_profiles', 'user_measurements', 'user_workouts');

-- Verify policies exist
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test basic functionality
INSERT INTO user_profiles (id, username, full_name, user_type) 
VALUES (gen_random_uuid(), 'test_user', 'Test User', 'user');

-- Clean up test data
DELETE FROM user_profiles WHERE username = 'test_user';
```

## 4. Preventive Measures

### Migration Best Practices
1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use transactions where possible**
4. **Include rollback procedures**
5. **Validate schema after each migration**

### Recommended Testing Procedure
```sql
-- Create a test script for each migration
BEGIN;
-- Migration code here
-- Validation queries
-- ROLLBACK; -- for testing
-- COMMIT; -- for actual application
```

### Monitoring Setup
```sql
-- Create a view to monitor migration status
CREATE OR REPLACE VIEW migration_status AS
SELECT 
    version,
    dirty,
    applied_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

## 5. Emergency Contacts and Resources

- **Supabase Support:** Dashboard > Help & Support
- **Documentation:** https://supabase.com/docs/guides/database/migrations
- **Community:** https://github.com/supabase/supabase/discussions

## 6. Post-Resolution Checklist

- [ ] All tables created successfully
- [ ] RLS policies applied and working
- [ ] Triggers functioning correctly
- [ ] Application can connect and perform CRUD operations
- [ ] User registration and authentication working
- [ ] Trainer profile creation working (if applicable)
- [ ] Data integrity maintained
- [ ] Performance acceptable
- [ ] Backup created and verified
- [ ] Documentation updated