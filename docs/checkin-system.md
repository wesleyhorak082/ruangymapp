# Gym Check-in System

This document describes the implementation of the gym check-in system for the Ruangym app.

## Overview

The check-in system allows users to:
- Check in to the gym by scanning a QR code
- View their current check-in status
- Check out when leaving the gym
- Track their workout duration
- Different logging for members vs trainers
- Admin dashboard for check-in history

## Database Schema

### Table: `gym_checkins`

```sql
CREATE TABLE gym_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'trainer')),
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  is_checked_in boolean NOT NULL DEFAULT true,
  check_in_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## API Endpoints

The system uses a centralized API layer (`lib/api.ts`) with the following functions:

### `gymAPI.checkIn(userId: string)`
- Checks if user is already checked in
- Creates a new check-in record
- Returns success/error response

### `gymAPI.checkOut(userId: string)`
- Finds the current active check-in
- Updates check-out time and status
- Calculates final duration

### `gymAPI.getCheckInStatus(userId: string)`
- Retrieves current check-in status
- Calculates current duration if checked in

### `gymAPI.getCheckInHistory(limit: number)`
- Retrieves all check-in records for admin purposes
- Includes user profile information
- Configurable limit parameter

### `gymAPI.getCheckInsByType(userType: 'user' | 'trainer', limit: number)`
- Filters check-ins by user type (members vs trainers)
- Useful for staff management and analytics

## Frontend Components

### Main Screen (`app/(tabs)/index.tsx`)
- Displays current check-in status above "Today's Workout"
- Shows check-in time and duration
- Provides check-out button when checked in
- Shows test QR code for development

### Check-in Screen (`app/checkin.tsx`)
- Camera interface for scanning QR codes
- Validates QR code format
- Calls check-in API on successful scan
- Shows success/error messages

### Admin Check-ins Screen (`app/admin-checkins.tsx`)
- Admin dashboard for viewing check-in history
- Filter by user type (members vs trainers)
- Shows detailed check-in information
- Only accessible to trainers/staff

### Custom Hook (`hooks/useCheckIn.ts`)
- Manages check-in state
- Provides check-in/check-out functions
- Auto-refreshes duration every minute
- Handles API communication

## User Type Logging

The system automatically detects user types and logs different information:

### Member Check-ins
- **Console Log**: `💪 MEMBER CHECK-IN: [Name] ([ID]) checked in at [Time]`
- **Reason**: "Member workout session"
- **Icon**: 💪

### Trainer Check-ins
- **Console Log**: `🏋️ TRAINER CHECK-IN: [Name] ([ID]) checked in at [Time]`
- **Reason**: "Staff check-in for training session"
- **Icon**: 🏋️

### Check-out Logging
- Similar format for check-outs with appropriate icons and timestamps

## QR Code Format

For testing purposes, the system accepts QR codes containing:
- `gym`
- `fitforge`
- `ruangym`
- `checkin`

### Test QR Code
The app displays a test QR code string: `ruangym:test:checkin:gym`

## Security Features

- Row Level Security (RLS) enabled on database
- Users can only access their own check-in records
- Authentication required for all operations
- Input validation on QR codes

## Usage Flow

1. **Check-in Process:**
   - User navigates to Check-in screen
   - Scans gym QR code
   - System validates QR code format
   - API creates check-in record
   - User sees success message

2. **Status Display:**
   - Main screen shows current check-in status
   - Displays check-in time and duration
   - Updates in real-time

3. **Check-out Process:**
   - User clicks "Check Out" button
   - Confirmation dialog appears
   - API updates check-in record
   - Status updates to "Not Checked In"

## Development Notes

- The system includes test QR codes for development
- Duration is calculated and updated every minute
- Error handling covers common scenarios
- API responses include detailed error messages

## Future Enhancements

- Real QR code generation with proper library
- Check-in history and analytics
- Integration with workout tracking
- Staff/admin check-in management
- Location-based check-in validation
