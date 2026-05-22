import { LogBox } from 'react-native';

import { isAndroidExpoGo } from './runtimeEnvironment';

if (isAndroidExpoGo()) {
  LogBox.ignoreLogs([
    '`expo-notifications` functionality is not fully supported in Expo Go',
    'expo-notifications: Android Push notifications',
  ]);
}
