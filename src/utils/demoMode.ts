export function isSpotzDemoModeEnabled() {
  const value = process.env.EXPO_PUBLIC_SPOTZ_DEMO_MODE;

  return value === '1' || value?.toLowerCase() === 'true';
}
