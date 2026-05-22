import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETED_STORAGE_KEY = '@spotz_onboarding_completed';
export const ALWAYS_SHOW_ONBOARDING = true;

export async function getHasCompletedOnboarding() {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY)) === 'true';
}

export async function setHasCompletedOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
}
