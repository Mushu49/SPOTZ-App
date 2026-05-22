import React from 'react';
import { Switch, SwitchProps } from 'react-native';

import { SPOTZ_BRAND } from '../../constants/brand';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';

type SpotzSwitchProps = Omit<SwitchProps, 'trackColor' | 'thumbColor'>;

export function SpotzSwitch(props: SpotzSwitchProps) {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Switch
      {...props}
      trackColor={{
        false: isDark ? '#3f3f46' : '#9CA3AF',
        true: SPOTZ_BRAND.accent,
      }}
      thumbColor="#ffffff"
    />
  );
}
