import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface ProfilePictureProps {
  avatarUrl?: string | null;
  fullName: string;
  size?: number;
  style?: any;
}

export default function ProfilePicture({ 
  avatarUrl, 
  fullName, 
  size = 50, 
  style 
}: ProfilePictureProps) {
  const initials = fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...style,
  };

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, containerStyle]}
      />
    );
  }

  return (
    <View style={[styles.initialsContainer, containerStyle]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.4 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
