import { useState, useEffect } from 'react';

export type UrgencyLevel = 'normal' | 'warning' | 'critical';

export interface StreakUrgency {
  urgencyLevel: UrgencyLevel;
  timeRemaining: number;
  isExpiringSoon: boolean;
  shouldShowWarning: boolean;
  shouldShowCritical: boolean;
  urgencyColor: string;
  urgencyMessage: string;
}

export const useStreakUrgency = (
  currentStreak: number,
  lastCheckinDate: string | null,
  streakFrozen: boolean
): StreakUrgency => {
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('normal');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!lastCheckinDate || currentStreak === 0 || streakFrozen) {
      setUrgencyLevel('normal');
      setTimeRemaining(0);
      return;
    }

    const calculateTimeRemaining = () => {
      const lastCheckin = new Date(lastCheckinDate);
      const now = new Date();
      const timeDiff = 24 - ((now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60));
      return Math.max(0, Math.ceil(timeDiff));
    };

    const updateUrgency = () => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 2) {
        setUrgencyLevel('critical');
      } else if (remaining <= 6) {
        setUrgencyLevel('warning');
      } else {
        setUrgencyLevel('normal');
      }
    };

    // Update immediately
    updateUrgency();

    // Update every minute
    const interval = setInterval(updateUrgency, 60000);

    return () => clearInterval(interval);
  }, [lastCheckinDate, currentStreak, streakFrozen]);

  const isExpiringSoon = urgencyLevel === 'warning' || urgencyLevel === 'critical';
  const shouldShowWarning = urgencyLevel === 'warning';
  const shouldShowCritical = urgencyLevel === 'critical';

  const getUrgencyColor = (): string => {
    switch (urgencyLevel) {
      case 'critical':
        return '#FF6B6B'; // Red
      case 'warning':
        return '#FFA500'; // Orange
      default:
        return '#667eea'; // Blue
    }
  };

  const getUrgencyMessage = (): string => {
    if (streakFrozen) {
      return 'Streak Frozen';
    }
    
    switch (urgencyLevel) {
      case 'critical':
        return `⚠️ Expires in ${timeRemaining}h`;
      case 'warning':
        return `⏰ Expires in ${timeRemaining}h`;
      default:
        return 'Current Streak';
    }
  };

  return {
    urgencyLevel,
    timeRemaining,
    isExpiringSoon,
    shouldShowWarning,
    shouldShowCritical,
    urgencyColor: getUrgencyColor(),
    urgencyMessage: getUrgencyMessage(),
  };
};
