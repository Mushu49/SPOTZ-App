import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function isRunningInExpoGo() {
  return Constants.appOwnership === 'expo' || Boolean(Constants.expoGoConfig);
}

export function isAndroidExpoGo() {
  return Platform.OS === 'android' && isRunningInExpoGo();
}
