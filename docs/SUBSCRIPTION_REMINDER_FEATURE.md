# Subscription Reminder Feature

## Overview

The Subscription Reminder feature allows gym administrators to send payment reminders to members and trainers whose subscriptions are ending soon or have expired.

## Features

- **One-Click Reminders**: Send professional subscription reminders with a single button click
- **Smart Visibility**: Reminder button only appears for users with unpaid/expired subscriptions
- **Dual Notification**: Reminders appear in both the Notifications tab and as system messages
- **Personalized Messages**: Each reminder includes the user's name and subscription expiration date
- **Professional Branding**: Messages are signed by "Ruan Kemp" for authenticity

## How It Works

### For Administrators

1. **Navigate to Admin Dashboard**:
   - Go to `Admin Members` to manage member subscriptions
   - Go to `Admin Trainers` to manage trainer subscriptions

2. **Access Actions**:
   - Click the **Edit** button (pencil icon) on any user's info card
   - This opens the Edit modal with all available actions

3. **Send Reminders**:
   - In the Edit modal, scroll down to the "Actions" section
   - Look for the 🔔 Send Reminder button (only visible for unpaid/expired users)
   - Click the button to send an immediate reminder

4. **Other Actions Available**:
   - **Block/Unblock**: Manage user access to the gym
   - **Delete**: Remove user from the system
   - All actions are organized in one convenient location

5. **Confirmation**:
   - Success message confirms the action was completed
   - User receives notification immediately (for reminders)

### For Users/Trainers

1. **Receive Notifications**:
   - Reminders appear in the Notifications tab
   - Full message content is displayed
   - Clear call-to-action for renewal

2. **Message Content**:
   ```
   🔔 Subscription Reminder

   Hi [Name],

   Your gym membership subscription is ending soon. To continue enjoying our facilities and services, please renew your subscription.

   Expires: [Date]

   Please contact me for renew.

   Thank you for being part of our gym community!

   - Ruan Kemp
   ```

## Technical Implementation

### Database Changes

- **New Notification Type**: `subscription_reminder` added to notifications table
- **Migration File**: `20250831000001_add_subscription_reminder_type.sql`

### Frontend Components

- **Admin Members Screen**: `app/admin-members.tsx`
- **Admin Trainers Screen**: `app/admin-trainers.tsx`
- **New UI Elements**: Reminder button with orange styling

### Backend Functions

- **Smart Button Logic**: Only shows for unpaid/expired users
- **Notification Creation**: Creates system notifications with full message content
- **Error Handling**: Graceful fallback if notification creation fails

## Button Styling

### Info Card
- **Edit Button**: Blue pencil icon - opens the action modal
- **Clean Interface**: Only one action button visible on each card
- **Simplified View**: Admin trainer cards show only essential info (name, email, specialty, location) - removed pricing, rating, experience, and certifications for cleaner management interface

### Action Modal
- **Send Reminder**: Orange (`#F39C12`) with bell emoji - only visible for unpaid/expired users
- **Block/Unblock**: Light yellow background (`#FFF3CD`) with dark yellow text (`#856404`) for better readability
- **Delete**: Light red background (`#F8D7DA`) with dark red text (`#721C24`) for better readability
- **Consistent Layout**: All actions organized in a dedicated "Actions" section below payment status
- **Payment Status Buttons**: Improved spacing and text alignment for better visual hierarchy

## Smart Visibility Rules

| Payment Status | Button Visible | Button Color |
|----------------|----------------|--------------|
| `paid` | ❌ Hidden | - |
| `unpaid` | ✅ Visible | Orange |
| `expired` | ✅ Visible | Orange |

## Benefits

1. **Improved Collections**: Proactive reminder system increases renewal rates
2. **Better User Experience**: Clear communication about subscription status
3. **Professional Image**: Branded messages from gym management
4. **Efficiency**: One-click reminders save admin time
5. **Consistency**: Standardized message format across all reminders
6. **Cleaner Interface**: Organized action buttons reduce visual clutter
7. **Better UX**: All related actions grouped logically in one modal
8. **Mobile Friendly**: Larger touch targets in the modal for better mobile experience

## Future Enhancements

- **Bulk Reminders**: Send reminders to multiple users at once
- **Scheduled Reminders**: Automatically send reminders before expiration
- **Template Customization**: Allow admins to modify message content
- **Analytics**: Track reminder effectiveness and response rates
- **Integration**: Connect with payment systems for direct renewal

## Usage Tips

1. **Regular Monitoring**: Check admin dashboard daily for expired subscriptions
2. **Timely Reminders**: Send reminders before subscriptions expire
3. **Follow-up**: Monitor user responses and follow up if needed
4. **Documentation**: Keep records of sent reminders for audit purposes

## Troubleshooting

### Common Issues

1. **Button Not Visible**: Check user's payment status in database
2. **Notification Failed**: Verify database permissions and notification type support
3. **User Not Receiving**: Check user's notification preferences

### Debug Steps

1. Check browser console for error messages
2. Verify database connection and permissions
3. Test with a known expired subscription user
4. Check notification table for created records

## Security Considerations

- **Admin-Only Access**: Feature restricted to authenticated admin users
- **User Privacy**: Reminders only sent to intended recipients
- **Data Validation**: Input sanitization and validation
- **Audit Trail**: All reminder actions are logged in database
