# Ruangym App

A React Native fitness app with gym check-in functionality.

## Features

### ✅ Check-in System
- **QR Code Check-in**: Users can check in to the gym by scanning QR codes
- **Real-time Status**: Shows current check-in status on the main screen
- **Check-out Functionality**: Users can check out when leaving the gym
- **Duration Tracking**: Automatically tracks workout duration
- **Status Display**: Shows check-in time and current duration above "Today's Workout"

### 🏋️ Other Features
- User authentication and profiles
- Workout tracking and progress
- Trainer booking system
- Progress monitoring

## Check-in System Implementation

The check-in system includes:

1. **Database Table**: `gym_checkins` with proper RLS policies
2. **API Layer**: Centralized API functions for check-in operations
3. **Custom Hook**: `useCheckIn` for managing check-in state
4. **UI Components**: Status display and check-out button
5. **QR Code Validation**: Accepts gym-related QR codes for testing

## Quick Start

### 1. Database Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### 2. Environment Variables
Create a `.env` file with:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start the App
```bash
npm install
npx expo start
```

## Testing the Check-in System

1. **Main Screen**: Shows current check-in status and test QR code
2. **Check-in Screen**: Camera interface for scanning QR codes
3. **QR Code Format**: Accepts codes containing `gym`, `fitforge`, `ruangym`, or `checkin`
4. **Test Mode**: Displays a test QR code string for development

## Project Structure

```
ruangymapp/
├── app/                    # React Native screens
│   ├── (tabs)/           # Main tab navigation
│   │   └── index.tsx     # Home screen with check-in status
│   └── checkin.tsx       # Check-in camera screen
├── hooks/
│   └── useCheckIn.ts     # Check-in state management
├── lib/
│   ├── api.ts            # Check-in API functions
│   ├── supabase.ts       # Supabase client
│   └── qrGenerator.ts    # QR code utilities
├── supabase/
│   └── migrations/       # Database migrations
└── docs/                 # Documentation
```

## Documentation

- [Check-in System Guide](docs/checkin-system.md)
- [Database Setup](docs/database-setup.md)

## Technologies

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Navigation**: Expo Router
- **State Management**: React Hooks + Custom Hooks
- **UI Components**: React Native + Expo Linear Gradient
