/*
  # Trainer bookings

  1. Create table trainer_bookings to store user -> trainer session bookings
  2. Enable RLS and add policies
*/

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.trainer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','canceled','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_bookings ENABLE ROW LEVEL SECURITY;

-- Users (clients) can create their own bookings
CREATE POLICY "Users can create own bookings"
ON public.trainer_bookings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
ON public.trainer_bookings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Trainers can view bookings assigned to them
CREATE POLICY "Trainers can view their bookings"
ON public.trainer_bookings
FOR SELECT TO authenticated
USING (auth.uid() = trainer_id);

-- Trainers can update status/notes of their bookings
CREATE POLICY "Trainers can update their bookings"
ON public.trainer_bookings
FOR UPDATE TO authenticated
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);


