import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showRating?: boolean;
  showCount?: boolean;
  totalRatings?: number;
}

export default function StarRating({ 
  rating, 
  onRatingChange, 
  size = 20, 
  readonly = false,
  showRating = false,
  showCount = false,
  totalRatings = 0
}: StarRatingProps) {
  const [currentRating, setCurrentRating] = useState(rating);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    setCurrentRating(rating);
  }, [rating]);

  const handleStarPress = (starRating: number) => {
    if (readonly || !onRatingChange) return;
    
    const newRating = currentRating === starRating ? 0 : starRating;
    setCurrentRating(newRating);
    onRatingChange(newRating);
  };

  const handleStarHover = (starRating: number) => {
    if (readonly) return;
    setHoverRating(starRating);
  };

  const handleStarLeave = () => {
    if (readonly) return;
    setHoverRating(0);
  };

  const displayRating = hoverRating || currentRating;

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarPress(star)}
            onPressIn={() => handleStarHover(star)}
            onPressOut={handleStarLeave}
            disabled={readonly}
            style={styles.starButton}
          >
            <Star
              size={size}
              color={star <= displayRating ? '#F59E0B' : '#E5E7EB'}
              fill={star <= displayRating ? '#F59E0B' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
      
      {showRating && (
        <View style={styles.ratingInfo}>
          <Text style={[styles.ratingText, { fontSize: size * 0.8 }]}>
            {currentRating > 0 ? currentRating.toFixed(1) : 'No rating'}
          </Text>
          {showCount && totalRatings > 0 && (
            <Text style={[styles.ratingCount, { fontSize: size * 0.6 }]}>
              ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 2,
  },
  ratingInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontWeight: 'bold',
    color: '#2D3436',
  },
  ratingCount: {
    color: '#6B7280',
    marginTop: 2,
  },
});
