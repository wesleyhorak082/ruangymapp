import { useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OnlineStatusTracker() {
  useOnlineStatus(); // Track online status globally
  
  // This component doesn't render anything, it just manages the online status
  return null;
}
