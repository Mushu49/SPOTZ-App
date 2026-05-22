import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { CategoryFilterId, getCategoryIconSource } from '../types';

type CategoryIconProps = {
  category: CategoryFilterId | string;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function CategoryIcon({ category, size = 18, style }: CategoryIconProps) {
  return (
    <Image
      source={getCategoryIconSource(category)}
      style={[
        {
          width: size,
          height: size,
          resizeMode: 'contain',
        },
        style,
      ]}
    />
  );
}
