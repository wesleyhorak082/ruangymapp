-- Fix Participant Type Constraints for Admin Messaging
-- This script updates the conversations table to allow 'admin' as a participant type

-- Step 1: Drop existing constraints
DO $$
BEGIN
  -- Drop participant_1_type constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_participant_1_type_check;
    RAISE NOTICE 'Dropped conversations_participant_1_type_check constraint';
  ELSE
    RAISE NOTICE 'conversations_participant_1_type_check constraint does not exist';
  END IF;

  -- Drop participant_2_type constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_2_type_check'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_participant_2_type_check;
    RAISE NOTICE 'Dropped conversations_participant_2_type_check constraint';
  ELSE
    RAISE NOTICE 'conversations_participant_2_type_check constraint does not exist';
  END IF;
END $$;

-- Step 2: Add new constraints that allow 'admin'
DO $$
BEGIN
  -- Add new constraint for participant_1_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_participant_1_type_check 
    CHECK (participant_1_type IN ('user', 'trainer', 'admin'));
    RAISE NOTICE 'Added new conversations_participant_1_type_check constraint';
  ELSE
    RAISE NOTICE 'conversations_participant_1_type_check constraint already exists';
  END IF;

  -- Add new constraint for participant_2_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_2_type_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_participant_2_type_check 
    CHECK (participant_2_type IN ('user', 'trainer', 'admin'));
    RAISE NOTICE 'Added new conversations_participant_2_type_check constraint';
  ELSE
    RAISE NOTICE 'conversations_participant_2_type_check constraint already exists';
  END IF;
END $$;

-- Step 3: Verify the changes and provide feedback
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICATION RESULTS ===';
  
  -- Check if constraints exist and show their definitions
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) THEN
    RAISE NOTICE 'participant_1_type constraint: EXISTS';
  ELSE
    RAISE NOTICE 'participant_1_type constraint: MISSING';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_2_type_check'
  ) THEN
    RAISE NOTICE 'participant_2_type constraint: EXISTS';
  ELSE
    RAISE NOTICE 'participant_2_type constraint: MISSING';
  END IF;
  
  RAISE NOTICE 'Participant type constraints updated successfully!';
  RAISE NOTICE 'Now conversations table allows: user, trainer, and admin as participant types';
  RAISE NOTICE '========================================';
END $$;

-- Show the actual constraint definitions
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname IN (
  'conversations_participant_1_type_check',
  'conversations_participant_2_type_check'
);
