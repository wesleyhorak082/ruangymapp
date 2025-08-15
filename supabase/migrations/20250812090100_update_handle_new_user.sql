/*
  # Sync user_type from auth metadata at signup

  1. Update trigger function handle_new_user to write user_type
     - Read user_type from new.raw_user_meta_data
     - Fallback to 'user' if absent/invalid

  2. Backfill existing user_profiles from auth.users metadata
*/

-- Ensure the trigger inserts user_type from auth metadata and creates trainer_profiles when needed
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_user_type text;
  v_trainer jsonb;
  v_specialty text;
  v_bio text;
  v_hourly_rate int;
  v_experience_years int;
  v_certifications text[];
BEGIN
  -- Set default values and handle null cases
  v_user_type := COALESCE(
    CASE
      WHEN (NEW.raw_user_meta_data ? 'user_type') AND (NEW.raw_user_meta_data->>'user_type' IN ('user','trainer'))
        THEN NEW.raw_user_meta_data->>'user_type'
      ELSE 'user'
    END,
    'user'
  );

  -- Insert user profile with error handling
  BEGIN
    INSERT INTO public.user_profiles (id, username, full_name, user_type)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_user_type
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
    -- Continue with user creation even if profile fails
  END;

  -- If trainer, attempt to create a trainer profile from metadata
  IF v_user_type = 'trainer' THEN
    BEGIN
      v_trainer := COALESCE(NEW.raw_user_meta_data->'trainer_info', '{}'::jsonb);
      v_specialty := COALESCE(NULLIF(v_trainer->>'specialty', ''), 'Personal Training');
      v_bio := NULLIF(v_trainer->>'bio', '');
      
      -- Safe parsing of numeric values
      v_hourly_rate := CASE 
        WHEN v_trainer->>'hourlyRate' ~ '^[0-9]+$' THEN (v_trainer->>'hourlyRate')::int
        ELSE 50
      END;
      
      v_experience_years := CASE 
        WHEN v_trainer->>'experienceYears' ~ '^[0-9]+$' THEN (v_trainer->>'experienceYears')::int
        ELSE 1
      END;
      
      -- Handle certifications array
      v_certifications := CASE
        WHEN (v_trainer ? 'certifications') AND v_trainer->>'certifications' <> '' THEN 
          string_to_array(v_trainer->>'certifications', ',')
        ELSE ARRAY[]::text[]
      END;

      -- Insert trainer profile only if it doesn't exist
      INSERT INTO public.trainer_profiles (
        id, specialty, bio, hourly_rate, rating, availability, experience_years, certifications, is_available
      )
      SELECT NEW.id,
             v_specialty,
             v_bio,
             v_hourly_rate,
             5.0,
             '[]'::jsonb,
             v_experience_years,
             v_certifications,
             true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.trainer_profiles tp WHERE tp.id = NEW.id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Failed to create trainer profile for user %: %', NEW.id, SQLERRM;
      -- Continue with user creation even if trainer profile fails
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing rows to align with auth metadata
UPDATE public.user_profiles p
SET user_type = CASE
  WHEN (u.raw_user_meta_data ? 'user_type') AND (u.raw_user_meta_data->>'user_type' IN ('user','trainer'))
    THEN u.raw_user_meta_data->>'user_type'
  ELSE 'user'
END,
updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND COALESCE(p.user_type, 'user') <> COALESCE(
        CASE
          WHEN (u.raw_user_meta_data ? 'user_type') AND (u.raw_user_meta_data->>'user_type' IN ('user','trainer'))
            THEN u.raw_user_meta_data->>'user_type'
          ELSE 'user'
        END,
        'user'
      );

-- Backfill trainer_profiles for users marked as trainer but missing a profile
INSERT INTO public.trainer_profiles (
  id, specialty, bio, hourly_rate, rating, availability, experience_years, certifications, is_available
)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->'trainer_info'->>'specialty', 'Personal Training') AS specialty,
       NULLIF(u.raw_user_meta_data->'trainer_info'->>'bio', '') AS bio,
       COALESCE(NULLIF(u.raw_user_meta_data->'trainer_info'->>'hourlyRate','')::int, 50) AS hourly_rate,
       5.0 AS rating,
       '[]'::jsonb AS availability,
       COALESCE(NULLIF(u.raw_user_meta_data->'trainer_info'->>'experienceYears','')::int, 1) AS experience_years,
       CASE
         WHEN (u.raw_user_meta_data->'trainer_info'->>'certifications') IS NOT NULL AND (u.raw_user_meta_data->'trainer_info'->>'certifications') <> ''
           THEN string_to_array(u.raw_user_meta_data->'trainer_info'->>'certifications', ',')
         ELSE ARRAY[]::text[]
       END AS certifications,
       true AS is_available
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE p.user_type = 'trainer'
  AND NOT EXISTS (
    SELECT 1 FROM public.trainer_profiles tp WHERE tp.id = u.id
  );


