import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPOTZ_BRAND } from '../constants/brand';
import { useAuth } from '../context/AuthContext';
import { LEGAL_PUBLIC_URLS, type LegalPageSlug } from '../data/legalPages';
import { SpotzLogo } from './SpotzLogo';

type AuthMode = 'login' | 'signup' | 'forgot';

const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  'If a SPOTZ account exists for this email, Firebase will send a reset link. Check your inbox and spam folder.';

type GlassInputProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  compact?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: TextInputProps['autoCorrect'];
  importantForAutofill?: TextInputProps['importantForAutofill'];
  returnKeyType?: TextInputProps['returnKeyType'];
  textContentType?: TextInputProps['textContentType'];
};

function MetallicButton({
  label,
  onPress,
  compact,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.metalButton, compact && styles.metalButtonCompact, disabled && styles.metalButtonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color="#0c1117" />
      ) : (
        <Text style={[styles.metalButtonText, compact && styles.metalButtonTextCompact]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function GlassInput({
  icon,
  placeholder,
  value,
  onChangeText,
  compact,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  autoCorrect = false,
  importantForAutofill,
  returnKeyType = 'next',
  textContentType,
}: GlassInputProps) {
  const [isSecure, setIsSecure] = useState(Boolean(secureTextEntry));

  return (
    <View style={[styles.inputGlass, compact && styles.inputGlassCompact]}>
      <Ionicons name={icon} size={compact ? 20 : 22} color={SPOTZ_BRAND.mutedText} style={styles.inputIcon} />
      <TextInput
        style={[styles.input, compact && styles.inputCompact]}
        placeholder={placeholder}
        placeholderTextColor="#aab1bc"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isSecure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        importantForAutofill={importantForAutofill}
        returnKeyType={returnKeyType}
        textContentType={textContentType}
        underlineColorAndroid="transparent"
      />
      {secureTextEntry && (
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setIsSecure((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons name={isSecure ? 'eye-off-outline' : 'eye-outline'} size={compact ? 20 : 22} color={SPOTZ_BRAND.mutedText} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.backButton}
      onPress={onPress}
      activeOpacity={0.72}
      hitSlop={{ top: 14, right: 18, bottom: 14, left: 18 }}
      accessibilityRole="button"
      accessibilityLabel="Back to login"
    >
      <Ionicons name="chevron-back" size={32} color="#ffffff" />
    </TouchableOpacity>
  );
}

function SignupLegalAgreement() {
  const handlePress = (label: string, slug: LegalPageSlug) => {
    Linking.openURL(LEGAL_PUBLIC_URLS[slug]).catch((error) => {
      console.error(`Failed to open ${label}`, error);
    });
  };

  return (
    <Text style={styles.signupLegalText}>
      By signing up, you agree to our{' '}
      <Text
        style={styles.signupLegalLink}
        onPress={() => handlePress('Terms of Use', 'terms')}
      >
        Terms of Use
      </Text>
      ,{' '}
      <Text
        style={styles.signupLegalLink}
        onPress={() => handlePress('Privacy Policy', 'privacy')}
      >
        Privacy Policy
      </Text>
      ,{' '}
      <Text
        style={styles.signupLegalLink}
        onPress={() => handlePress('Community Guidelines', 'community')}
      >
        Community Guidelines
      </Text>
      , and{' '}
      <Text
        style={styles.signupLegalLink}
        onPress={() => handlePress('Account Deletion Policy', 'account-deletion')}
      >
        Account Deletion Policy
      </Text>
      .
    </Text>
  );
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const useTightVerticalSpacing = viewportHeight < 820;
  const estimatedSignUpSafeHeight = viewportHeight - insets.top - Math.max(insets.bottom, 12);
  const useTightSignUpSpacing = estimatedSignUpSafeHeight < 700;
  const useVeryTightSignUpSpacing = estimatedSignUpSafeHeight < 640;
  const authTopPadding = Math.max(
    insets.top + (useTightVerticalSpacing ? 0 : 8),
    Platform.OS === 'android' ? 10 : 16
  );
  const { login, signUp, sendResetEmail } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const isSignUpMode = mode === 'signup';
  const androidBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 38) : insets.bottom;
  const bottomSafePadding = androidBottomInset + (useTightVerticalSpacing ? 12 : 16);
  const signUpTopPadding = Math.max(
    insets.top + (useTightSignUpSpacing ? 4 : 8),
    10
  );
  const signUpBottomPadding =
    Math.max(insets.bottom, 10) + (useTightSignUpSpacing ? 6 : 10);
  const signUpBackButtonLift = useVeryTightSignUpSpacing ? -6 : useTightSignUpSpacing ? -12 : -18;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRules = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  }), [password]);

  const resetStateForMode = (nextMode: AuthMode) => {
    Keyboard.dismiss();
    setMode(nextMode);
    setError('');
    setConfirmation('');
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email or username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password, rememberMe);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to log in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    const cleanUsername = username.trim();

    if (!cleanUsername || !email.trim() || !password || !confirmPassword) {
      setError('Fill in all fields to create your account.');
      return;
    }

    if (!/^[A-Za-z0-9_]+$/.test(cleanUsername)) {
      setError('Username can only use letters, numbers, and underscores.');
      return;
    }

    if (!passwordRules.length || !passwordRules.uppercase || !passwordRules.number) {
      setError('Password must include 8 characters, one uppercase letter, and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp(cleanUsername, email, password);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setConfirmation('');

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('Enter the email address for your SPOTZ account.');
      return;
    }

    if (!isValidEmailAddress(cleanEmail)) {
      setError('Enter a valid email address, like name@example.com.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendResetEmail(cleanEmail);
      setConfirmation(FORGOT_PASSWORD_SUCCESS_MESSAGE);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to send reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.background}>
          <View pointerEvents="none" style={styles.mapTextureOne} />
          <View pointerEvents="none" style={styles.mapTextureTwo} />
          <View pointerEvents="none" style={styles.vignette} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              isSignUpMode && styles.signupScrollContent,
              isSignUpMode
                ? { height: viewportHeight, paddingTop: signUpTopPadding, paddingBottom: signUpBottomPadding }
                : { minHeight: viewportHeight, paddingTop: authTopPadding, paddingBottom: bottomSafePadding },
            ]}
            scrollEnabled={!isSignUpMode}
            bounces={!isSignUpMode}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mode === 'login' ? (
              <View style={[styles.loginContent, useTightVerticalSpacing && styles.loginContentTight]}>
                <SpotzLogo
                  showSubtext={false}
                  style={styles.loginLogo}
                  imageStyle={styles.loginLogoImage}
                />

                <View
                  style={[
                    styles.formBlock,
                    styles.signUpFormBlock,
                    useTightVerticalSpacing && styles.formBlockTight,
                  ]}
                >
                  <GlassInput
                    icon="mail-outline"
                    placeholder="Email or username"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="username"
                    importantForAutofill="yes"
                    keyboardType="email-address"
                    textContentType="username"
                  />
                  <GlassInput
                    icon="lock-closed-outline"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="password"
                    importantForAutofill="yes"
                    secureTextEntry
                    textContentType="password"
                    returnKeyType="done"
                  />

                  <View style={styles.loginOptionsRow}>
                    <Pressable
                      style={styles.rememberWrap}
                      onPress={() => setRememberMe((prev) => !prev)}
                    >
                      <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                        {rememberMe && <Ionicons name="checkmark" size={18} color="#ffffff" />}
                      </View>
                      <View style={styles.rememberTextBlock}>
                        <Text style={styles.rememberText}>Remember me</Text>
                        <Text style={styles.rememberSubtext}>Keep me signed in for 30 days</Text>
                      </View>
                    </Pressable>
                    <TouchableOpacity
                      style={styles.forgotPasswordButton}
                      onPress={() => resetStateForMode('forgot')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <MetallicButton
                    label="Login"
                    onPress={handleLogin}
                    loading={isSubmitting}
                  />

                  <View style={styles.footerLinkRow}>
                    <Text style={styles.footerText}>{"Don't have an account?"}</Text>
                    <TouchableOpacity onPress={() => resetStateForMode('signup')} activeOpacity={0.7}>
                      <Text style={styles.footerLink}>Sign up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {mode === 'signup' ? (
              <View style={[styles.signupContent, useTightSignUpSpacing && styles.signupContentTight]}>
                <View style={[
                  styles.signupHeader,
                  useTightSignUpSpacing && styles.signupHeaderTight,
                  useVeryTightSignUpSpacing && styles.signupHeaderVeryTight,
                ]}>
                  <View style={[styles.signupBackWrap, { transform: [{ translateY: signUpBackButtonLift }] }]}>
                    <AuthBackButton onPress={() => resetStateForMode('login')} />
                  </View>
                  <SpotzLogo
                    compact
                    variant="pin"
                    showSubtext={false}
                    style={[styles.signupLogo, useVeryTightSignUpSpacing && styles.signupLogoVeryTight]}
                    imageStyle={[
                      styles.signupLogoImage,
                      useTightSignUpSpacing && styles.signupLogoImageTight,
                      useVeryTightSignUpSpacing && styles.signupLogoImageVeryTight,
                    ]}
                  />
                  <Text style={[styles.signupTitle, useVeryTightSignUpSpacing && styles.signupTitleVeryTight]}>
                    Create account
                  </Text>
                  <Text style={[styles.signupSubtitle, useVeryTightSignUpSpacing && styles.signupSubtitleVeryTight]}>
                    Join SPOTZ and discover photo spots.
                  </Text>
                </View>

                <View style={[
                  styles.signupFormBlock,
                  useTightSignUpSpacing && styles.signupFormBlockTight,
                ]}>
                  <GlassInput
                    icon="person-outline"
                    placeholder="Username"
                    value={username}
                    onChangeText={(text) => setUsername(text.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))}
                    autoComplete="username"
                    importantForAutofill="yes"
                    textContentType="username"
                    compact
                  />
                  <GlassInput
                    icon="mail-outline"
                    placeholder="Email address"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    importantForAutofill="yes"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    compact
                  />
                  <GlassInput
                    icon="lock-closed-outline"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    secureTextEntry
                    textContentType="newPassword"
                    compact
                  />
                  <GlassInput
                    icon="lock-closed-outline"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    secureTextEntry
                    textContentType="newPassword"
                    returnKeyType="done"
                    compact
                  />

                  <Text style={styles.signupPasswordHint}>
                    Password: 8+ characters, one uppercase letter, and one number.
                  </Text>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <MetallicButton
                    label="Sign up"
                    onPress={handleSignUp}
                    loading={isSubmitting}
                    compact
                  />

                  <View style={styles.signupLegalRow}>
                    <SignupLegalAgreement />
                  </View>

                  <View style={[styles.footerLinkRow, styles.signUpFooterLinkRow]}>
                    <Text style={styles.footerText}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => resetStateForMode('login')} activeOpacity={0.7}>
                      <Text style={styles.footerLink}>Login</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {mode === 'forgot' ? (
              <View style={[styles.panelContent, useTightVerticalSpacing && styles.panelContentTight]}>
                <AuthBackButton onPress={() => resetStateForMode('login')} />
                <Text style={styles.screenTitle}>Forgot password?</Text>
                <SpotzLogo
                  compact
                  showSubtext={false}
                  style={styles.panelLogo}
                  imageStyle={styles.panelLogoImage}
                />

                <View style={styles.mailOrb}>
                  <Ionicons name="mail-outline" size={48} color="#f2f5fa" />
                </View>
                <Text style={styles.forgotCopy}>
                  Enter your account email and Firebase will send a secure password reset link.
                </Text>

                <View style={[styles.formBlock, useTightVerticalSpacing && styles.formBlockTight]}>
                  <GlassInput
                    icon="mail-outline"
                    placeholder="Email address"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    importantForAutofill="yes"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="done"
                  />

                  {!!error && <Text style={styles.errorText}>{error}</Text>}
                  {!!confirmation && <Text style={styles.successText}>{confirmation}</Text>}

                  <MetallicButton
                    label="Send reset link"
                    onPress={handleForgotPassword}
                    loading={isSubmitting}
                  />

                  <View style={styles.footerLinkRow}>
                    <Text style={styles.footerText}>Remember your password?</Text>
                    <TouchableOpacity onPress={() => resetStateForMode('login')} activeOpacity={0.7}>
                      <Text style={styles.footerLink}>Login</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  background: {
    flex: 1,
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  signupScrollContent: {
    justifyContent: 'center',
  },
  mapTextureOne: {
    position: 'absolute',
    top: -120,
    left: -60,
    width: 460,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(139, 158, 139, 0.13)',
    transform: [{ rotate: '-18deg' }],
  },
  mapTextureTwo: {
    position: 'absolute',
    right: -120,
    bottom: -80,
    width: 380,
    height: 340,
    borderRadius: 190,
    backgroundColor: 'rgba(18, 25, 28, 0.58)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  loginContentTight: {
    paddingTop: 0,
  },
  panelContent: {
    flexGrow: 1,
    minHeight: '100%',
    paddingTop: 0,
  },
  panelContentTight: {
    paddingTop: 0,
  },
  signupContent: {
    width: '100%',
    justifyContent: 'flex-start',
    gap: 14,
  },
  signupContentTight: {
    gap: 10,
  },
  signupHeader: {
    minHeight: 162,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  signupHeaderTight: {
    minHeight: 144,
  },
  signupHeaderVeryTight: {
    minHeight: 126,
  },
  signupBackWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    elevation: 10,
  },
  signupLogo: {
    marginTop: 0,
    marginBottom: 6,
  },
  signupLogoVeryTight: {
    marginBottom: 3,
  },
  signupLogoImage: {
    width: 78,
    height: 90,
  },
  signupLogoImageTight: {
    width: 68,
    height: 78,
  },
  signupLogoImageVeryTight: {
    width: 60,
    height: 70,
  },
  signupTitle: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  signupTitleVeryTight: {
    fontSize: 21,
  },
  signupSubtitle: {
    marginTop: 5,
    color: SPOTZ_BRAND.mutedText,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  signupSubtitleVeryTight: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  loginLogo: {
    marginTop: -46,
    marginBottom: -10,
  },
  loginLogoImage: {
    width: 784,
    height: 272,
  },
  panelLogo: {
    marginTop: -18,
    marginBottom: 0,
  },
  panelLogoImage: {
    width: 664,
    height: 232,
  },
  formBlock: {
    width: '100%',
    gap: 10,
  },
  formBlockTight: {
    gap: 8,
  },
  signUpFormBlock: {
    marginTop: -14,
    gap: 6,
  },
  signUpFormBlockAndroid: {
    marginTop: -64,
    gap: 4,
  },
  signupFormBlock: {
    width: '100%',
    gap: 7,
  },
  signupFormBlockTight: {
    gap: 5,
  },
  inputGlass: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(139, 158, 139, 0.24)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  inputGlassCompact: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    minHeight: 42,
    color: SPOTZ_BRAND.offWhite,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  inputCompact: {
    minHeight: 38,
    fontSize: 15,
  },
  eyeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginOptionsRow: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 38,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  rememberTextBlock: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderColor: 'rgba(244, 242, 236, 0.72)',
  },
  rememberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rememberSubtext: {
    color: '#a2a9b3',
    fontSize: 12,
    marginTop: 2,
  },
  linkText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  successText: {
    color: '#b9d1b9',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  metalButton: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    backgroundColor: SPOTZ_BRAND.accent,
    borderWidth: 1,
    borderColor: 'rgba(214, 224, 214, 0.58)',
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  metalButtonCompact: {
    minHeight: 50,
    borderRadius: 13,
  },
  metalButtonDisabled: {
    opacity: 0.62,
  },
  metalButtonText: {
    color: '#08100b',
    fontSize: 20,
    fontWeight: '800',
  },
  metalButtonTextCompact: {
    fontSize: 18,
  },
  footerLinkRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 28,
  },
  signUpFooterLinkRow: {
    marginTop: 0,
    minHeight: 24,
  },
  signupLegalRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  signupLegalText: {
    color: '#aab1bc',
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  signupLegalLink: {
    color: SPOTZ_BRAND.accent,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  footerText: {
    color: '#aab1bc',
    fontSize: 16,
  },
  footerLink: {
    color: SPOTZ_BRAND.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    width: 50,
    height: 50,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -12,
    zIndex: 10,
    elevation: 10,
  },
  screenTitle: {
    marginTop: -42,
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  screenSubtitle: {
    marginTop: 10,
    marginBottom: 0,
    color: SPOTZ_BRAND.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  signupPasswordHint: {
    color: '#aab1bc',
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  rulesCard: {
    minHeight: 84,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  rulesCardSignUp: {
    minHeight: 76,
    paddingVertical: 7,
    gap: 14,
  },
  rulesCardAndroid: {
    minHeight: 70,
    paddingVertical: 5,
  },
  rulesTitle: {
    color: SPOTZ_BRAND.mutedText,
    fontSize: 13,
    marginBottom: 4,
  },
  requirementRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIconBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(174, 182, 192, 0.42)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  requirementIconBoxMet: {
    borderColor: SPOTZ_BRAND.accent,
    backgroundColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 2,
  },
  requirementDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(174, 182, 192, 0.52)',
  },
  ruleText: {
    color: SPOTZ_BRAND.mutedText,
    fontSize: 13,
    lineHeight: 20,
  },
  ruleTextMet: {
    color: '#dbe7db',
  },
  mailOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 46,
    backgroundColor: 'rgba(139, 158, 139, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 158, 139, 0.24)',
  },
  forgotCopy: {
    marginTop: 20,
    marginBottom: 30,
    color: SPOTZ_BRAND.mutedText,
    fontSize: 17,
    lineHeight: 28,
    textAlign: 'center',
  },
});
