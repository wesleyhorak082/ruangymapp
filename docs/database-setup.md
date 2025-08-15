# Database Setup for Check-in System

## Prerequisites

1. **Supabase Account**: You need a Supabase account and project
2. **Supabase CLI**: Install the Supabase CLI for local development

## Installation

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link Your Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## Database Migration

### 1. Run Migrations
```bash
supabase db push
```

This will create the `gym_checkins` table and all necessary functions.

### 2. Verify Table Creation
You can verify the table was created by checking your Supabase dashboard or running:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'gym_checkins';
```

## Environment Variables

Make sure you have these environment variables set in your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Manual SQL Execution

If you prefer to run the SQL manually, you can copy the contents of `supabase/migrations/20250813000000_gym_checkins.sql` and execute it in your Supabase SQL editor.

## Testing the System

1. **Start your React Native app**
2. **Navigate to the main screen** - you should see the "Gym Status" section
3. **Go to the Check-in screen** - scan a QR code or use the test code
4. **Verify check-in works** - the status should update on the main screen

## Troubleshooting

### Common Issues

1. **"Cannot find project ref"**
   - Run `supabase link` with your project reference
   - Check your Supabase dashboard for the project reference

2. **Permission denied errors**
   - Ensure RLS policies are properly set
   - Check that the user is authenticated

3. **Table not found**
   - Verify the migration ran successfully
   - Check the Supabase dashboard for the table

### Debug Mode

Run commands with debug flag for more information:
```bash
supabase db push --debug
```

## Next Steps

After setting up the database:

1. Test the check-in functionality
2. Customize the QR code validation logic
3. Add additional features like check-in history
4. Implement proper QR code generation
