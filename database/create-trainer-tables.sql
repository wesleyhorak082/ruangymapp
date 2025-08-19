-- Create trainer_programs table for storing custom workout programs created by trainers
CREATE TABLE IF NOT EXISTS public.trainer_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.user_program_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.trainer_programs(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, program_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trainer_programs_trainer_id ON public.trainer_programs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_programs_active ON public.trainer_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_user_id ON public.user_program_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_program_id ON public.user_program_assignments(program_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trainer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainer_programs
CREATE POLICY "Trainers can manage their own programs" ON public.trainer_programs
    FOR ALL USING (auth.uid() = trainer_id);

CREATE POLICY "Users can view active trainer programs" ON public.trainer_programs
    FOR SELECT USING (is_active = true);

-- RLS Policies for user_program_assignments
CREATE POLICY "Users can view their own program assignments" ON public.user_program_assignments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view assignments to their programs" ON public.user_program_assignments
    FOR SELECT USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can assign programs to users" ON public.user_program_assignments
    FOR INSERT WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update assignments to their programs" ON public.user_program_assignments
    FOR UPDATE USING (auth.uid() = trainer_id);

-- Create function to handle trainer program assignment
CREATE OR REPLACE FUNCTION public.assign_trainer_program_to_user(
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
        SELECT 1 FROM public.trainer_programs 
        WHERE id = p_program_id AND trainer_id = p_trainer_id AND is_active = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Program not found or not owned by trainer'
        );
    END IF;

    -- Check if user is connected to trainer
    IF NOT EXISTS (
        SELECT 1 FROM public.connection_requests 
        WHERE user_id = p_user_id AND trainer_id = p_trainer_id AND status = 'approved'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User is not connected to this trainer'
        );
    END IF;

    -- Insert or update assignment
    INSERT INTO public.user_program_assignments (user_id, trainer_id, program_id)
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
GRANT EXECUTE ON FUNCTION public.assign_trainer_program_to_user(UUID, UUID, UUID) TO authenticated;
