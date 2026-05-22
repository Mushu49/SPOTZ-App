import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

type FavoriteHeartButtonProps = {
  isFavorite: boolean;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function FavoriteHeartButton({
  isFavorite,
  onPress,
  size = 42,
  style,
}: FavoriteHeartButtonProps) {
  const favoriteScale = useRef(new Animated.Value(1)).current;
  const iconSize = Math.round(size * 0.52);

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();

    Animated.sequence([
      Animated.timing(favoriteScale, {
        toValue: 0.88,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(favoriteScale, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.favoriteButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Animated.View style={{ transform: [{ scale: favoriteScale }] }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={iconSize}
          color={isFavorite ? '#ff3b30' : '#ffffff'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  favoriteButton: {
    position: 'absolute',
    top: 14,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
});
