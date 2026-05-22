import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPOTZ_BRAND, SPOTZ_PIN_LOGO_SOURCE, SPOTZ_WORDMARK_LOGO_SOURCE } from '../constants/brand';

const SPOTZ_MAP_BACKGROUND = require('../../assets/images/spotz-loading-background.jpg');
const DEFAULT_MINIMUM_LOADING_DURATION_MS = 2200;
const ENTRANCE_ANIMATION_DURATION_MS = 1760;
const FINAL_BRANDING_HOLD_MS = 1000;

type LoadingScreenProps = {
  isReady: boolean;
  minimumDurationMs?: number;
  onFinish: () => void;
};

export function LoadingScreen({
  isReady,
  minimumDurationMs = DEFAULT_MINIMUM_LOADING_DURATION_MS,
  onFinish,
}: LoadingScreenProps) {
  const { width, height } = useWindowDimensions();
  const initialHeight = useRef(height).current;
  const mountedAt = useRef(Date.now()).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const backgroundCoverOpacity = useRef(new Animated.Value(1)).current;
  const pinOpacity = useRef(new Animated.Value(0)).current;
  const pinTranslateY = useRef(new Animated.Value(-620)).current;
  const pinScale = useRef(new Animated.Value(0.98)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;
  const shadowScaleX = useRef(new Animated.Value(0.42)).current;
  const shadowScaleY = useRef(new Animated.Value(0.78)).current;
  const focusOverlayOpacity = useRef(new Animated.Value(0)).current;
  const blurOverlayOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(8)).current;
  const hasFinished = useRef(false);
  const pinStageHeight = Math.min(Math.max(height * 0.46, 310), 380);
  const logoStageHeight = pinStageHeight + 150;
  const pinCanvasSize = Math.min(width * 1.48, 590);
  const wordmarkCanvasSize = Math.min(width * 1.28, 512);

  useEffect(() => {
    const backgroundUri = Image.resolveAssetSource(SPOTZ_MAP_BACKGROUND)?.uri;
    if (backgroundUri) {
      Image.prefetch(backgroundUri).catch(() => {});
    }
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const startY = -Math.max(initialHeight * 0.72, 520);
    pinTranslateY.setValue(startY);
    pinOpacity.setValue(0);
    pinScale.setValue(0.98);
    shadowOpacity.setValue(0);
    shadowScaleX.setValue(0.42);
    shadowScaleY.setValue(0.78);
    focusOverlayOpacity.setValue(0);
    blurOverlayOpacity.setValue(0);
    wordmarkOpacity.setValue(0);
    wordmarkTranslateY.setValue(8);

    const entrance = Animated.sequence([
      Animated.timing(backgroundCoverOpacity, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.sequence([
          Animated.delay(90),
          Animated.timing(pinOpacity, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pinTranslateY, {
              toValue: 12,
              duration: 570,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(pinScale, {
              toValue: 1.025,
              duration: 570,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(320),
              Animated.timing(shadowOpacity, {
                toValue: 0.42,
                duration: 230,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(pinTranslateY, {
              toValue: -18,
              duration: 170,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(pinScale, {
              toValue: 0.992,
              duration: 170,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(shadowScaleX, {
              toValue: 1.18,
              duration: 115,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(shadowScaleY, {
              toValue: 0.54,
              duration: 115,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pinTranslateY, {
              toValue: 0,
              duration: 340,
              easing: Easing.out(Easing.elastic(1.08)),
              useNativeDriver: true,
            }),
            Animated.timing(pinScale, {
              toValue: 1,
              duration: 340,
              easing: Easing.out(Easing.elastic(1.08)),
              useNativeDriver: true,
            }),
            Animated.timing(shadowScaleX, {
              toValue: 0.95,
              duration: 300,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(shadowScaleY, {
              toValue: 0.72,
              duration: 300,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(shadowOpacity, {
              toValue: 0.32,
              duration: 300,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(blurOverlayOpacity, {
          toValue: 0.22,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(focusOverlayOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    entrance.start();

    return () => {
      entrance.stop();
    };
  }, [
    backgroundCoverOpacity,
    blurOverlayOpacity,
    focusOverlayOpacity,
    initialHeight,
    pinOpacity,
    pinScale,
    pinTranslateY,
    shadowOpacity,
    shadowScaleX,
    shadowScaleY,
    wordmarkOpacity,
    wordmarkTranslateY,
  ]);

  useEffect(() => {
    if (!isReady || hasFinished.current) return;

    const elapsed = Date.now() - mountedAt;
    const minimumRemaining = minimumDurationMs - elapsed;
    const finalBrandingHoldRemaining =
      ENTRANCE_ANIMATION_DURATION_MS + FINAL_BRANDING_HOLD_MS - elapsed;
    const remaining = Math.max(0, minimumRemaining, finalBrandingHoldRemaining);
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        hasFinished.current = true;
        onFinish();
      });
    }, remaining);

    return () => clearTimeout(timer);
  }, [isReady, minimumDurationMs, mountedAt, onFinish, screenOpacity]);

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <ImageBackground
        source={SPOTZ_MAP_BACKGROUND}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <Animated.View style={[styles.backgroundFade, { opacity: backgroundCoverOpacity }]} />
        <Animated.Image
          source={SPOTZ_MAP_BACKGROUND}
          style={[styles.fullScreenBlurImage, { opacity: blurOverlayOpacity }]}
          resizeMode="cover"
          blurRadius={Platform.OS === 'ios' ? 2 : 1}
        />
        <View style={styles.darkOverlay} />
        <View style={styles.vignette} />
        <Animated.View style={[styles.focusOverlay, { opacity: focusOverlayOpacity }]} />

        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.logoStage, { minHeight: logoStageHeight }]}>
            <Animated.View
              style={[
                styles.landingShadow,
                { top: pinStageHeight - 26 },
                {
                  opacity: shadowOpacity,
                  transform: [{ scaleX: shadowScaleX }, { scaleY: shadowScaleY }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pinStage,
                { height: pinStageHeight },
                {
                  opacity: pinOpacity,
                  transform: [{ translateY: pinTranslateY }, { scale: pinScale }],
                },
              ]}
            >
              <Image
                source={SPOTZ_PIN_LOGO_SOURCE}
                style={[styles.logoIcon, { width: pinCanvasSize, height: pinCanvasSize }]}
                resizeMode="contain"
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.wordmarkStage,
                {
                  opacity: wordmarkOpacity,
                  transform: [{ translateY: wordmarkTranslateY }],
                },
              ]}
            >
              <Image
                source={SPOTZ_WORDMARK_LOGO_SOURCE}
                style={[styles.wordmarkImage, { width: wordmarkCanvasSize, height: wordmarkCanvasSize }]}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 1,
    width: '100%',
    height: '100%',
  },
  backgroundFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  fullScreenBlurImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
  },
  pinStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  logoIcon: {
    position: 'absolute',
  },
  landingShadow: {
    position: 'absolute',
    width: 150,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
  },
  wordmarkStage: {
    width: '100%',
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginTop: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 3,
  },
  wordmarkImage: {
    position: 'absolute',
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 5, 5, 0.22)',
  },
});
