import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPOTZ_BRAND } from '../constants/brand';
import { PhotoCategory, getCategoryIconSource, getCategoryMarkerImageSource } from '../types';
import { setHasCompletedOnboarding } from '../utils/onboarding';

const { width, height: screenHeight } = Dimensions.get('window');
const AUTO_ADVANCE_INTERVAL_MS = 5000;
const HOLD_TO_PAUSE_THRESHOLD_MS = 260;
const ONBOARDING_AUTO_ADVANCE = true;
const CREATE_ANDROID_FORM_SCALE =
  screenHeight < 700 ? 0.88 : screenHeight < 780 ? 0.93 : 0.96;
const CREATE_ANDROID_FORM_TOP =
  screenHeight < 700 ? 62 : screenHeight < 780 ? 90 : 112;

type OnboardingCard = {
  title: string;
  subtitle: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: 'discover' | 'save' | 'create';
};

const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    title: 'Discover SPOTZ',
    subtitle: 'Find beautiful photography locations around you and around the world.',
    accent: SPOTZ_BRAND.accent,
    icon: 'map-outline',
    kind: 'discover',
  },
  {
    title: 'Explore SPOTZ',
    subtitle: 'Browse Popular, Nearby, Recent, and Favorites so every great spot is easy to find again.',
    accent: '#c89aa0',
    icon: 'heart-outline',
    kind: 'save',
  },
  {
    title: 'Create SPOTZ',
    subtitle: 'Upload photo spots with images, category, location, and details other photographers need.',
    accent: SPOTZ_BRAND.accent,
    icon: 'camera-outline',
    kind: 'create',
  },
];

type OnboardingScreenProps = {
  onFinish: () => void;
};

function ProgressBar({
  index,
  activeIndex,
  progress,
  autoAdvanceEnabled,
}: {
  index: number;
  activeIndex: number;
  progress: Animated.Value;
  autoAdvanceEnabled: boolean;
}) {
  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const isActiveWithoutTimer = index === activeIndex && !autoAdvanceEnabled;

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          index < activeIndex && styles.progressFillComplete,
          index === activeIndex && { width: autoAdvanceEnabled ? fillWidth : '100%' },
          isActiveWithoutTimer && styles.progressFillActive,
          index > activeIndex && styles.progressFillPending,
        ]}
      />
    </View>
  );
}

function DiscoverIllustration({
  motion,
}: {
  motion: Animated.Value;
  accent: string;
}) {
  const mapScale = motion.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [1.34, 1, 1],
  });
  const mapTranslateX = motion.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [-24, 0, 0],
  });
  const mapTranslateY = motion.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [18, 0, 0],
  });
  const pulse = motion.interpolate({
    inputRange: [0, 0.72, 0.86, 1],
    outputRange: [1, 1, 1.08, 1],
  });
  const mapRoads: { style: ViewStyle; major?: boolean }[] = [
    { style: { top: '13%', left: '-8%', width: '118%', height: 5, transform: [{ rotate: '-4deg' }] }, major: true },
    { style: { top: '25%', left: '-4%', width: '108%', height: 3, transform: [{ rotate: '1deg' }] } },
    { style: { top: '36%', left: '-10%', width: '116%', height: 4, transform: [{ rotate: '-7deg' }] }, major: true },
    { style: { top: '47%', left: '-6%', width: '112%', height: 2, transform: [{ rotate: '3deg' }] } },
    { style: { top: '58%', left: '-10%', width: '122%', height: 5, transform: [{ rotate: '8deg' }] }, major: true },
    { style: { top: '69%', left: '-8%', width: '110%', height: 3, transform: [{ rotate: '-2deg' }] } },
    { style: { top: '80%', left: '-10%', width: '118%', height: 4, transform: [{ rotate: '4deg' }] }, major: true },
    { style: { top: '-6%', left: '12%', width: 3, height: '116%', transform: [{ rotate: '5deg' }] } },
    { style: { top: '-6%', left: '28%', width: 5, height: '118%', transform: [{ rotate: '-3deg' }] }, major: true },
    { style: { top: '-6%', left: '43%', width: 2, height: '116%', transform: [{ rotate: '2deg' }] } },
    { style: { top: '-8%', left: '57%', width: 4, height: '122%', transform: [{ rotate: '7deg' }] }, major: true },
    { style: { top: '-6%', left: '73%', width: 3, height: '114%', transform: [{ rotate: '-5deg' }] } },
    { style: { top: '-10%', left: '88%', width: 4, height: '124%', transform: [{ rotate: '4deg' }] }, major: true },
    { style: { top: '18%', left: '5%', width: '62%', height: 2, transform: [{ rotate: '35deg' }] } },
    { style: { top: '44%', right: '-8%', width: '78%', height: 3, transform: [{ rotate: '-31deg' }] }, major: true },
    { style: { bottom: '18%', left: '-8%', width: '74%', height: 2, transform: [{ rotate: '-24deg' }] } },
  ];
  const mapBlocks: ViewStyle[] = [
    { top: '17%', left: '15%', width: '10%', height: '7%' },
    { top: '18%', left: '31%', width: '13%', height: '8%' },
    { top: '16%', left: '61%', width: '11%', height: '9%' },
    { top: '28%', left: '8%', width: '13%', height: '8%' },
    { top: '30%', left: '33%', width: '16%', height: '9%' },
    { top: '28%', right: '16%', width: '14%', height: '9%' },
    { top: '42%', left: '17%', width: '16%', height: '8%' },
    { top: '44%', left: '47%', width: '13%', height: '9%' },
    { top: '41%', right: '9%', width: '13%', height: '10%' },
    { top: '62%', left: '19%', width: '14%', height: '9%' },
    { top: '64%', left: '48%', width: '16%', height: '8%' },
    { top: '70%', right: '16%', width: '12%', height: '8%' },
  ];
  const mapLabels: { label: string; style: TextStyle }[] = [
    { label: 'Central Ave', style: { top: '34%', left: '16%', transform: [{ rotate: '-7deg' }] } },
    { label: 'Market St', style: { top: '56%', right: '16%', transform: [{ rotate: '8deg' }] } },
    { label: 'Riverside', style: { top: '24%', right: '4%', transform: [{ rotate: '78deg' }] } },
    { label: 'Old Town', style: { top: '43%', left: '35%' } },
    { label: 'North Park', style: { top: '14%', right: '24%' } },
  ];
  const mapPins: {
    category: PhotoCategory;
    position: { left?: `${number}%`; right?: `${number}%`; top?: `${number}%`; bottom?: `${number}%` };
    range: [number, number, number, number, number];
  }[] = [
    { category: 'landscape', position: { left: '13%', top: '18%' }, range: [0, 0.18, 0.28, 0.36, 1] },
    { category: 'street', position: { right: '18%', top: '22%' }, range: [0, 0.3, 0.4, 0.48, 1] },
    { category: 'car_photography', position: { left: '44%', top: '32%' }, range: [0, 0.42, 0.5, 0.58, 1] },
    { category: 'portrait', position: { left: '20%', top: '44%' }, range: [0, 0.5, 0.57, 0.64, 1] },
    { category: 'wildlife', position: { right: '20%', top: '48%' }, range: [0, 0.56, 0.62, 0.68, 1] },
    { category: 'landscape', position: { left: '58%', top: '14%' }, range: [0, 0.61, 0.66, 0.72, 1] },
    { category: 'street', position: { left: '10%', top: '62%' }, range: [0, 0.65, 0.7, 0.76, 1] },
    { category: 'portrait', position: { right: '8%', top: '61%' }, range: [0, 0.69, 0.74, 0.8, 1] },
    { category: 'car_photography', position: { left: '38%', top: '70%' }, range: [0, 0.73, 0.78, 0.84, 1] },
    { category: 'wildlife', position: { right: '38%', top: '54%' }, range: [0, 0.77, 0.82, 0.88, 1] },
  ];

  return (
    <View style={styles.mapPanel}>
      <Animated.View
        style={[
          styles.mapZoomLayer,
          {
            transform: [
              { translateX: mapTranslateX },
              { translateY: mapTranslateY },
              { scale: mapScale },
            ],
          },
        ]}
      >
        <View style={styles.cityMapBase} />
        <View style={styles.cityWaterway} />
        <View style={[styles.cityPark, styles.cityParkNorth]} />
        <View style={[styles.cityPark, styles.cityParkSouth]} />
        {mapBlocks.map((block, index) => (
          <View key={`block-${index}`} style={[styles.cityBlock, block]} />
        ))}
        {mapRoads.map((road, index) => (
          <View
            key={`road-${index}`}
            style={[styles.cityRoad, road.major && styles.cityRoadMajor, road.style]}
          />
        ))}
        {mapLabels.map((item) => (
          <Text key={item.label} style={[styles.cityMapLabel, item.style]}>
            {item.label}
          </Text>
        ))}
        {mapPins.map((pin, index) => {
          const pinOpacity = motion.interpolate({
            inputRange: pin.range,
            outputRange: [0, 0, 1, 1, 1],
          });
          const popScale = motion.interpolate({
            inputRange: pin.range,
            outputRange: [0.2, 0.2, 1.18, 1, 1],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.spotMarkerOnboarding,
                pin.position,
                {
                  opacity: pinOpacity,
                  transform: [{ scale: Animated.multiply(popScale, pulse) }],
                },
              ]}
            >
              <Image
                source={getCategoryMarkerImageSource(pin.category, true)}
                style={styles.spotMarkerImage}
                resizeMode="contain"
              />
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

function SaveIllustration({
  motion,
  accent,
}: {
  motion: Animated.Value;
  accent: string;
}) {
  const feedTranslateY = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [56, -230],
  });
  const featuredTranslateY = motion.interpolate({
    inputRange: [0, 0.34, 0.66, 1],
    outputRange: [12, -8, -2, 0],
  });
  const featuredScale = motion.interpolate({
    inputRange: [0, 0.42, 0.72, 1],
    outputRange: [0.98, 1.025, 1, 1],
  });
  const sectionsOpacity = motion.interpolate({
    inputRange: [0, 0.45, 0.62, 1],
    outputRange: [0, 0, 1, 1],
  });
  const sectionsTranslateY = motion.interpolate({
    inputRange: [0, 0.45, 0.7, 1],
    outputRange: [12, 12, 0, 0],
  });
  const cards: {
    title: string;
    meta: string;
    category: PhotoCategory;
    tag: string;
    colors: string[];
    featured?: boolean;
  }[] = [
    {
      title: 'Golden bridge overlook',
      meta: 'Popular now',
      category: 'landscape',
      tag: 'Landscape',
      colors: ['#a8c8d9', '#d7b175', '#253f5b', '#101827'],
      featured: true,
    },
    {
      title: 'Neon street corner',
      meta: '2.1 km away',
      category: 'street',
      tag: 'Street',
      colors: ['#243b55', '#ef7d57', '#101827', '#050814'],
    },
    {
      title: 'Classic car garage',
      meta: 'Saved by 42',
      category: 'car_photography',
      tag: 'Car',
      colors: ['#43515f', '#c74646', '#171a21', '#07090d'],
    },
    {
      title: 'Soft window portraits',
      meta: 'Recent',
      category: 'portrait',
      tag: 'Portrait',
      colors: ['#d7bca4', '#80604f', '#28202a', '#100b10'],
    },
  ];

  return (
    <View style={styles.exploreFeedScreen}>
      <Animated.View
        style={[
          styles.exploreFeedLayer,
          {
            transform: [{ translateY: feedTranslateY }],
          },
        ]}
      >
        <View style={styles.exploreHeaderMock}>
          <Text style={styles.exploreHeaderTitle}>Discover</Text>
          <View style={styles.exploreSearchPill}>
            <Ionicons name="search" size={15} color="rgba(235, 241, 249, 0.58)" />
            <Text style={styles.exploreSearchText}>Search photo spots</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.exploreTabRow,
            {
              opacity: sectionsOpacity,
              transform: [{ translateY: sectionsTranslateY }],
            },
          ]}
        >
          {['Popular', 'Nearby', 'Recent'].map((label, index) => (
            <View
              key={label}
              style={[styles.exploreTabPill, index === 0 && styles.exploreTabPillActive]}
            >
              <Text style={[styles.exploreTabText, index === 0 && styles.exploreTabTextActive]}>
                {label}
              </Text>
            </View>
          ))}
        </Animated.View>

        <View style={styles.exploreCardsColumn}>
          {cards.map((card, index) => {
            const likeStart = [0.18, 0.5, 0.78][index];
            const shouldAnimateLike = likeStart !== undefined;
            const outlineHeartOpacity = shouldAnimateLike
              ? motion.interpolate({
                  inputRange: [0, likeStart, Math.min(likeStart + 0.05, 1), 1],
                  outputRange: [1, 1, 0, 0],
                })
              : 1;
            const filledHeartOpacity = shouldAnimateLike
              ? motion.interpolate({
                  inputRange: [0, likeStart, Math.min(likeStart + 0.04, 1), 1],
                  outputRange: [0, 0, 1, 1],
                })
              : 0;
            const likedHeartScale = shouldAnimateLike
              ? motion.interpolate({
                  inputRange: [
                    0,
                    likeStart,
                    Math.min(likeStart + 0.06, 1),
                    Math.min(likeStart + 0.14, 1),
                    Math.min(likeStart + 0.24, 1),
                    1,
                  ],
                  outputRange: [0.72, 0.72, 1.58, 0.9, 1.08, 1],
                })
              : 1;
            const heartGlowOpacity = shouldAnimateLike
              ? motion.interpolate({
                  inputRange: [
                    0,
                    likeStart,
                    Math.min(likeStart + 0.05, 1),
                    Math.min(likeStart + 0.22, 1),
                    1,
                  ],
                  outputRange: [0, 0, 0.62, 0, 0],
                })
              : 0;
            const heartGlowScale = shouldAnimateLike
              ? motion.interpolate({
                  inputRange: [0, likeStart, Math.min(likeStart + 0.22, 1), 1],
                  outputRange: [0.72, 0.72, 1.55, 1.55],
                })
              : 1;
            const cardContent = (
              <>
                <View style={[styles.explorePhotoMock, { backgroundColor: card.colors[0] }]}>
                  <View style={[styles.explorePhotoSkyline, { backgroundColor: card.colors[1] }]} />
                  <View style={[styles.explorePhotoGround, { backgroundColor: card.colors[2] }]} />
                  <View style={[styles.explorePhotoShadow, { backgroundColor: card.colors[3] }]} />
                  <View style={styles.explorePhotoHighlight} />
                </View>
                <View style={styles.exploreCardBody}>
                  <View style={styles.exploreCardTitleRow}>
                    <Text style={styles.exploreCardTitle}>{card.title}</Text>
                    <View style={styles.exploreFavoriteBadge}>
                      <Animated.View
                        style={[
                          styles.exploreHeartGlowLayer,
                          {
                            backgroundColor: accent,
                            opacity: heartGlowOpacity,
                            transform: [{ scale: heartGlowScale }],
                          },
                        ]}
                      />
                      <Animated.View
                        style={[styles.exploreHeartIconLayer, { opacity: outlineHeartOpacity }]}
                      >
                        <Ionicons name="heart-outline" size={18} color="rgba(245, 248, 252, 0.86)" />
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.exploreHeartIconLayer,
                          {
                            opacity: filledHeartOpacity,
                            transform: [{ scale: likedHeartScale }],
                          },
                        ]}
                      >
                        <Ionicons name="heart" size={17} color="#ff3b30" />
                      </Animated.View>
                    </View>
                  </View>
                  <View style={styles.exploreCardMetaRow}>
                    <View style={styles.exploreCategoryTag}>
                      <Image
                        source={getCategoryIconSource(card.category)}
                        style={styles.exploreCategoryIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.exploreCategoryText}>{card.tag}</Text>
                    </View>
                    <Text style={styles.exploreMetaText}>{card.meta}</Text>
                  </View>
                </View>
              </>
            );

            if (card.featured) {
              return (
                <Animated.View
                  key={card.title}
                  style={[
                    styles.exploreSpotCard,
                    styles.exploreFeaturedCard,
                    {
                      transform: [{ translateY: featuredTranslateY }, { scale: featuredScale }],
                    },
                  ]}
                >
                  {cardContent}
                </Animated.View>
              );
            }

            return (
              <View key={card.title} style={styles.exploreSpotCard}>
                {cardContent}
              </View>
            );
          })}
        </View>
      </Animated.View>
      <View style={styles.exploreFeedDarken} />
    </View>
  );
}

function CreateIllustration({
  motion,
  accent,
}: {
  motion: Animated.Value;
  accent: string;
}) {
  const panelOpacity = motion.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 1, 1],
  });
  const panelTranslateY = motion.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [18, 0, 0],
  });
  const formScale = Platform.OS === 'android' ? CREATE_ANDROID_FORM_SCALE : 1;
  const photoOpacity = motion.interpolate({
    inputRange: [0, 0.14, 0.22, 1],
    outputRange: [0, 0, 1, 1],
  });
  const firstPhotoTranslate = motion.interpolate({
    inputRange: [0, 0.14, 0.26, 1],
    outputRange: [34, 34, 0, 0],
  });
  const secondPhotoTranslate = motion.interpolate({
    inputRange: [0, 0.2, 0.32, 1],
    outputRange: [40, 40, 0, 0],
  });
  const thirdPhotoTranslate = motion.interpolate({
    inputRange: [0, 0.26, 0.38, 1],
    outputRange: [46, 46, 0, 0],
  });
  const chipOpacity = motion.interpolate({
    inputRange: [0, 0.38, 0.48, 1],
    outputRange: [0, 0, 1, 1],
  });
  const selectedChipScale = motion.interpolate({
    inputRange: [0, 0.48, 0.56, 0.64, 1],
    outputRange: [1, 1, 1.05, 1, 1],
  });
  const fieldOpacity = motion.interpolate({
    inputRange: [0, 0.52, 0.62, 1],
    outputRange: [0, 0, 1, 1],
  });
  const locationTextWidth = motion.interpolate({
    inputRange: [0, 0.54, 0.68, 1],
    outputRange: ['0%', '0%', '72%', '72%'],
  });
  const titleTextWidth = motion.interpolate({
    inputRange: [0, 0.6, 0.72, 1],
    outputRange: ['0%', '0%', '64%', '64%'],
  });
  const detailsTextWidth = motion.interpolate({
    inputRange: [0, 0.64, 0.76, 1],
    outputRange: ['0%', '0%', '88%', '88%'],
  });
  const buttonOpacity = motion.interpolate({
    inputRange: [0, 0.72, 0.78, 1],
    outputRange: [0.5, 0.5, 1, 1],
  });
  const buttonPressScale = motion.interpolate({
    inputRange: [0, 0.78, 0.84, 0.9, 1],
    outputRange: [1, 1, 0.97, 1, 1],
  });
  const buttonBackgroundColor = motion.interpolate({
    inputRange: [0, 0.82, 0.94, 1],
    outputRange: [
      'rgba(139, 158, 139, 0.18)',
      'rgba(139, 158, 139, 0.18)',
      accent,
      accent,
    ],
  });
  const buttonBorderColor = motion.interpolate({
    inputRange: [0, 0.82, 0.94, 1],
    outputRange: [
      'rgba(139, 158, 139, 0.38)',
      'rgba(139, 158, 139, 0.38)',
      accent,
      accent,
    ],
  });
  const addSpotStateOpacity = motion.interpolate({
    inputRange: [0, 0.84, 0.91, 1],
    outputRange: [1, 1, 0, 0],
  });
  const createdStateOpacity = motion.interpolate({
    inputRange: [0, 0.88, 0.96, 1],
    outputRange: [0, 0, 1, 1],
  });
  const createdStateScale = motion.interpolate({
    inputRange: [0, 0.88, 0.96, 1],
    outputRange: [0.96, 0.96, 1.03, 1],
  });
  const ambientShiftX = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-12, 8, -12],
  });
  const ambientShiftY = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [8, -8, 8],
  });
  const ambientReverseShiftX = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [10, -10, 10],
  });
  const photoThumbs = [
    { translateY: firstPhotoTranslate, colors: ['#d2b28d', '#4f6f88', '#141a22'] },
    { translateY: secondPhotoTranslate, colors: ['#92b8a1', '#2d6049', '#0e1513'] },
    { translateY: thirdPhotoTranslate, colors: ['#aab6ca', '#b06b57', '#151827'] },
  ];
  const categoryChips: { label: string; category: PhotoCategory; selected?: boolean }[] = [
    { label: 'Landscape', category: 'landscape', selected: true },
    { label: 'Street', category: 'street' },
    { label: 'Car', category: 'car_photography' },
  ];

  return (
    <View style={styles.createFlowScene}>
      <View style={styles.createFlowBackdrop}>
        <Animated.View
          style={[
            styles.createAmbientWash,
            styles.createAmbientWashBlue,
            {
              transform: [
                { translateX: ambientShiftX },
                { translateY: ambientShiftY },
                { rotate: '-14deg' },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.createAmbientWash,
            styles.createAmbientWashGreen,
            {
              transform: [
                { translateX: ambientReverseShiftX },
                { translateY: ambientShiftY },
                { rotate: '16deg' },
              ],
            },
          ]}
        />
        <View style={[styles.createAmbientRoad, styles.createAmbientRoadOne]} />
        <View style={[styles.createAmbientRoad, styles.createAmbientRoadTwo]} />
        <View style={[styles.createAmbientRoad, styles.createAmbientRoadThree]} />
        <View style={[styles.createAmbientRoad, styles.createAmbientRoadFour]} />
        <View style={styles.createVignetteTop} />
        <View style={styles.createVignetteBottom} />
      </View>
      <Animated.View
        style={[
          styles.createFormPanel,
          {
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }, { scale: formScale }],
          },
        ]}
      >
        <View style={styles.createUploadBox}>
          <View style={styles.createUploadHeader}>
            <Ionicons name="images-outline" size={17} color="rgba(235, 241, 249, 0.72)" />
            <Text style={styles.createUploadLabel}>Photos</Text>
            <Text style={styles.createUploadCount}>3/3</Text>
          </View>
          <View style={styles.createPhotoRow}>
            {photoThumbs.map((photo, index) => (
              <Animated.View
                key={`create-photo-${index}`}
                style={[
                  styles.createPhotoThumb,
                  {
                    opacity: photoOpacity,
                    transform: [{ translateY: photo.translateY }],
                  },
                ]}
              >
                <View style={[styles.createPhotoSky, { backgroundColor: photo.colors[0] }]} />
                <View style={[styles.createPhotoMid, { backgroundColor: photo.colors[1] }]} />
                <View style={[styles.createPhotoGround, { backgroundColor: photo.colors[2] }]} />
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View style={[styles.createCategorySection, { opacity: chipOpacity }]}>
          <Text style={styles.createFieldLabel}>Category</Text>
          <View style={styles.createCategoryRow}>
            {categoryChips.map((chip) => (
              <Animated.View
                key={chip.label}
                style={[
                  styles.createCategoryChip,
                  chip.selected && styles.createCategoryChipSelected,
                  chip.selected && {
                    borderColor: accent,
                    transform: [{ scale: selectedChipScale }],
                  },
                ]}
              >
                <Image
                  source={getCategoryIconSource(chip.category)}
                  style={styles.createCategoryIcon}
                  resizeMode="contain"
                />
                <Text style={styles.createCategoryText}>{chip.label}</Text>
                {chip.selected && <Ionicons name="checkmark-circle" size={16} color={accent} />}
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.createFieldsStack, { opacity: fieldOpacity }]}>
          <View style={styles.createInputField}>
            <Text style={styles.createFieldLabel}>Location</Text>
            <View style={styles.createTypedLineTrack}>
              <Animated.View style={[styles.createTypedLine, { width: locationTextWidth }]} />
            </View>
          </View>
          <View style={styles.createInputField}>
            <Text style={styles.createFieldLabel}>Title</Text>
            <View style={styles.createTypedLineTrack}>
              <Animated.View style={[styles.createTypedLine, { width: titleTextWidth }]} />
            </View>
          </View>
          <View style={[styles.createInputField, styles.createDetailsField]}>
            <Text style={styles.createFieldLabel}>Details</Text>
            <View style={styles.createTypedLineTrack}>
              <Animated.View style={[styles.createTypedLine, { width: detailsTextWidth }]} />
            </View>
            <View style={styles.createTypedLineShort} />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.createButton,
            {
              opacity: buttonOpacity,
              backgroundColor: buttonBackgroundColor,
              borderColor: buttonBorderColor,
              transform: [{ scale: buttonPressScale }],
            },
          ]}
        >
          <Animated.View style={[styles.createButtonState, { opacity: addSpotStateOpacity }]}>
            <Text style={styles.createButtonText}>Add Spot</Text>
            <Ionicons name="arrow-up-circle" size={18} color="#dfffee" />
          </Animated.View>
          <Animated.View
            style={[
              styles.createButtonState,
              styles.createButtonStateOverlay,
              {
                opacity: createdStateOpacity,
                transform: [{ scale: createdStateScale }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
            <Text style={styles.createButtonCreatedText}>SPOTZ Created</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <View style={styles.createFlowDarken} />
    </View>
  );
}
function OnboardingIllustration({ card, motion }: { card: OnboardingCard; motion: Animated.Value }) {
  if (card.kind === 'save') {
    return <SaveIllustration motion={motion} accent={card.accent} />;
  }

  if (card.kind === 'create') {
    return <CreateIllustration motion={motion} accent={card.accent} />;
  }

  return <DiscoverIllustration motion={motion} accent={card.accent} />;
}

function OnboardingSceneBackground({
  card,
  motion,
}: {
  card: OnboardingCard;
  motion: Animated.Value;
}) {
  if (card.kind === 'discover') {
    return <DiscoverIllustration motion={motion} accent={card.accent} />;
  }

  if (card.kind === 'save') {
    return <SaveIllustration motion={motion} accent={card.accent} />;
  }

  if (card.kind === 'create') {
    return <CreateIllustration motion={motion} accent={card.accent} />;
  }

  return (
    <View style={styles.sceneBackground}>
      <View style={[styles.sceneWash, { backgroundColor: card.accent }]} />
      <View style={styles.sceneGridLineOne} />
      <View style={styles.sceneGridLineTwo} />
      <View style={styles.sceneGridLineThree} />
      <View style={styles.sceneCenterpiece}>
        <OnboardingIllustration card={card} motion={motion} />
      </View>
    </View>
  );
}

function OnboardingCopyPanel({
  card,
}: {
  card: OnboardingCard;
}) {
  return (
    <View style={styles.copyPanel}>
      <View style={[styles.iconBubble, { borderColor: card.accent }]}>
        <Ionicons name={card.icon} size={22} color={card.accent} />
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.subtitle}>{card.subtitle}</Text>
    </View>
  );
}

export function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressValueRef = useRef(0);
  const isFinishingRef = useRef(false);
  const isProgressPausedRef = useRef(false);
  const pressStartedAtRef = useRef(0);
  const didHoldToPauseRef = useRef(false);
  const activeCard = ONBOARDING_CARDS[activeIndex];
  const bottomPadding = Math.max(insets.bottom, 18) + 20;

  const completeOnboarding = useCallback(async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    progressAnimationRef.current?.stop();
    progress.stopAnimation();
    motion.stopAnimation();
    await setHasCompletedOnboarding();
    onFinish();
  }, [motion, onFinish, progress]);

  const goToNext = useCallback(() => {
    if (activeIndex >= ONBOARDING_CARDS.length - 1) {
      completeOnboarding();
      return;
    }

    setActiveIndex((prev) => Math.min(prev + 1, ONBOARDING_CARDS.length - 1));
  }, [activeIndex, completeOnboarding]);

  const advanceToNextCard = useCallback(() => {
    if (activeIndex >= ONBOARDING_CARDS.length - 1) {
      progressAnimationRef.current?.stop();
      progressValueRef.current = 1;
      progress.setValue(1);
      return;
    }

    setActiveIndex((prev) => Math.min(prev + 1, ONBOARDING_CARDS.length - 1));
  }, [activeIndex, progress]);

  const goToNextFromTap = useCallback(() => {
    progressAnimationRef.current?.stop();
    isProgressPausedRef.current = false;
    progressValueRef.current = 1;
    progress.setValue(1);
    goToNext();
  }, [goToNext, progress]);

  const startProgressAnimation = useCallback((fromValue: number) => {
    if (!ONBOARDING_AUTO_ADVANCE) {
      progressAnimationRef.current?.stop();
      progressValueRef.current = 0;
      progress.setValue(0);
      return;
    }

    const startValue = Math.min(Math.max(fromValue, 0), 1);
    const remainingDuration = Math.max(0, (1 - startValue) * AUTO_ADVANCE_INTERVAL_MS);

    progressAnimationRef.current?.stop();
    progress.setValue(startValue);
    progressValueRef.current = startValue;

    if (remainingDuration <= 16) {
      advanceToNextCard();
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: remainingDuration,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    progressAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished && !isProgressPausedRef.current) {
        progressValueRef.current = 1;
        advanceToNextCard();
      }
    });
  }, [advanceToNextCard, progress]);

  const goToPreviousFromTap = useCallback(() => {
    progressAnimationRef.current?.stop();
    isProgressPausedRef.current = false;
    progressValueRef.current = 0;
    progress.setValue(0);

    if (activeIndex === 0) {
      startProgressAnimation(0);
      return;
    }

    setActiveIndex((prev) => Math.max(prev - 1, 0));
  }, [activeIndex, progress, startProgressAnimation]);

  const pauseProgress = useCallback(() => {
    if (!ONBOARDING_AUTO_ADVANCE) return;
    if (isFinishingRef.current || isProgressPausedRef.current) return;

    isProgressPausedRef.current = true;
    progress.stopAnimation((value) => {
      progressValueRef.current = value;
    });
  }, [progress]);

  const resumeProgress = useCallback(() => {
    if (!ONBOARDING_AUTO_ADVANCE) return;
    if (isFinishingRef.current || !isProgressPausedRef.current) return;

    isProgressPausedRef.current = false;
    startProgressAnimation(progressValueRef.current);
  }, [startProgressAnimation]);

  const handleCardPressIn = useCallback(() => {
    pressStartedAtRef.current = Date.now();
    didHoldToPauseRef.current = false;
    pauseProgress();
  }, [pauseProgress]);

  const handleCardPressOut = useCallback(() => {
    const pressDuration = Date.now() - pressStartedAtRef.current;
    didHoldToPauseRef.current = pressDuration >= HOLD_TO_PAUSE_THRESHOLD_MS;

    if (didHoldToPauseRef.current) {
      resumeProgress();
    }
  }, [resumeProgress]);

  const handleCardPress = useCallback((event: GestureResponderEvent) => {
    if (didHoldToPauseRef.current) {
      didHoldToPauseRef.current = false;
      return;
    }

    const tapX = event.nativeEvent.locationX;
    const isLeftTap = tapX < width / 2;

    if (isLeftTap) {
      goToPreviousFromTap();
      return;
    }

    goToNextFromTap();
  }, [goToNextFromTap, goToPreviousFromTap]);

  useEffect(() => {
    progressAnimationRef.current?.stop();
    isProgressPausedRef.current = false;
    progressValueRef.current = 0;
    progress.setValue(0);

    if (activeIndex >= ONBOARDING_CARDS.length - 1) {
      progressValueRef.current = 1;
      progress.setValue(1);
      return () => {
        progressAnimationRef.current?.stop();
      };
    }

    startProgressAnimation(0);

    return () => {
      progressAnimationRef.current?.stop();
    };
  }, [activeIndex, progress, startProgressAnimation]);

  useEffect(() => {
    motion.setValue(0);
    const motionDurationMs = activeCard.kind === 'create' ? 5600 : 2600;
    const loop = Animated.loop(
      Animated.timing(motion, {
        toValue: 1,
        duration: motionDurationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [activeCard.kind, activeIndex, motion]);

  const progressItems = useMemo(
    () =>
      ONBOARDING_CARDS.map((_, index) => (
        <ProgressBar
          key={index}
          index={index}
          activeIndex={activeIndex}
          progress={progress}
          autoAdvanceEnabled={ONBOARDING_AUTO_ADVANCE}
        />
      )),
    [activeIndex, progress]
  );

  return (
    <View style={styles.container}>
      <OnboardingSceneBackground card={activeCard} motion={motion} />
      <View style={styles.readabilityScrim} />
      <Pressable
        style={styles.tapLayer}
        onPress={handleCardPress}
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
      >
        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: bottomPadding }]}>
          <View style={styles.topBar}>
            <View style={styles.progressRow}>{progressItems}</View>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={completeOnboarding}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contentSpacer} />

          {activeIndex === ONBOARDING_CARDS.length - 1 && (
            <TouchableOpacity
              style={styles.floatingPrimaryButton}
              onPress={goToNextFromTap}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Get started"
            >
              <Text style={styles.primaryButtonText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color="#07111f" />
            </TouchableOpacity>
          )}

          <OnboardingCopyPanel card={activeCard} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b12',
  },
  readabilityScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 12, 0.22)',
  },
  sceneBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070b12',
    overflow: 'hidden',
  },
  sceneWash: {
    position: 'absolute',
    top: -80,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.16,
  },
  sceneGridLineOne: {
    position: 'absolute',
    top: '18%',
    left: -40,
    right: -40,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  sceneGridLineTwo: {
    position: 'absolute',
    top: '42%',
    left: -60,
    right: -20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    transform: [{ rotate: '10deg' }],
  },
  sceneGridLineThree: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '34%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    transform: [{ rotate: '14deg' }],
  },
  sceneCenterpiece: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 90,
    paddingBottom: 220,
  },
  tapLayer: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  progressFillComplete: {
    width: '100%',
  },
  progressFillActive: {
    opacity: 0.72,
  },
  progressFillPending: {
    width: '0%',
  },
  skipButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 14,
    fontWeight: '700',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 10, 18, 0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  brandText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  contentSpacer: {
    flex: 1,
  },
  mapPanel: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#111923',
  },
  mapZoomLayer: {
    position: 'absolute',
    top: -70,
    left: -70,
    right: -70,
    bottom: -70,
  },
  cityMapBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#242f3e',
  },
  cityWaterway: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 138,
    height: '125%',
    borderRadius: 70,
    backgroundColor: '#17263a',
    opacity: 0.92,
    transform: [{ rotate: '8deg' }],
  },
  cityPark: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: '#244737',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(135, 180, 139, 0.18)',
    opacity: 0.72,
  },
  cityParkNorth: {
    top: '9%',
    left: '50%',
    width: '22%',
    height: '11%',
    transform: [{ rotate: '-8deg' }],
  },
  cityParkSouth: {
    bottom: '13%',
    left: '7%',
    width: '28%',
    height: '13%',
    transform: [{ rotate: '14deg' }],
  },
  cityBlock: {
    position: 'absolute',
    borderRadius: 7,
    backgroundColor: '#263342',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.045)',
    opacity: 0.82,
  },
  cityRoad: {
    position: 'absolute',
    borderRadius: 3,
    backgroundColor: '#3a4654',
    opacity: 0.86,
  },
  cityRoadMajor: {
    backgroundColor: '#4c5a69',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 15, 22, 0.34)',
    opacity: 0.96,
  },
  cityMapLabel: {
    position: 'absolute',
    color: 'rgba(178, 165, 137, 0.66)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  spotMarkerOnboarding: {
    position: 'absolute',
    width: 62,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  spotMarkerPinShape: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  spotMarkerPinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    zIndex: 2,
  },
  spotMarkerPinShapeTail: {
    position: 'absolute',
    top: 27,
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  spotMarkerImage: {
    width: 62,
    height: 78,
  },
  exploreFeedScreen: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#070b12',
  },
  exploreFeedLayer: {
    position: 'absolute',
    top: 82,
    left: 18,
    right: 18,
    paddingBottom: 280,
  },
  exploreHeaderMock: {
    gap: 14,
    marginBottom: 16,
  },
  exploreHeaderTitle: {
    color: '#ffffff',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
  },
  exploreSearchPill: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  exploreSearchText: {
    color: 'rgba(235, 241, 249, 0.58)',
    fontSize: 14,
    fontWeight: '700',
  },
  exploreTabRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 16,
  },
  exploreTabPill: {
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  exploreTabPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  exploreTabText: {
    color: 'rgba(235, 241, 249, 0.62)',
    fontSize: 13,
    fontWeight: '800',
  },
  exploreTabTextActive: {
    color: '#ffffff',
  },
  exploreCardsColumn: {
    gap: 16,
  },
  exploreSpotCard: {
    overflow: 'hidden',
    borderRadius: 25,
    backgroundColor: 'rgba(10, 15, 24, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 8,
  },
  exploreFeaturedCard: {
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  explorePhotoMock: {
    height: 150,
    overflow: 'hidden',
  },
  explorePhotoSkyline: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: 54,
    height: 42,
    borderRadius: 22,
    opacity: 0.82,
    transform: [{ rotate: '-5deg' }],
  },
  explorePhotoGround: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -26,
    height: 88,
    borderRadius: 44,
    transform: [{ rotate: '4deg' }],
  },
  explorePhotoShadow: {
    position: 'absolute',
    left: '18%',
    right: '12%',
    bottom: 18,
    height: 28,
    borderRadius: 14,
    opacity: 0.5,
  },
  explorePhotoHighlight: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    opacity: 0.54,
  },
  exploreCardBody: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 11,
  },
  exploreCardTitleRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  exploreCardTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  exploreFavoriteBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exploreHeartIconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreHeartGlowLayer: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  exploreCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  exploreCategoryTag: {
    height: 28,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
  exploreCategoryIcon: {
    width: 16,
    height: 16,
  },
  exploreCategoryText: {
    color: 'rgba(245, 248, 252, 0.86)',
    fontSize: 12,
    fontWeight: '800',
  },
  exploreMetaText: {
    color: 'rgba(235, 241, 249, 0.58)',
    fontSize: 12,
    fontWeight: '800',
  },
  exploreFeedDarken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 12, 0.24)',
  },
  createFlowScene: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#070b12',
  },
  createFlowBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b111c',
    overflow: 'hidden',
  },
  createAmbientWash: {
    position: 'absolute',
    width: '140%',
    height: 170,
    borderRadius: 85,
    opacity: 0.18,
  },
  createAmbientWashBlue: {
    top: 96,
    left: '-26%',
    backgroundColor: '#405348',
  },
  createAmbientWashGreen: {
    bottom: 250,
    right: '-28%',
    backgroundColor: '#1f5b48',
    opacity: 0.14,
  },
  createAmbientRoad: {
    position: 'absolute',
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.075)',
  },
  createAmbientRoadOne: {
    top: '19%',
    left: -40,
    right: -40,
    transform: [{ rotate: '-7deg' }],
  },
  createAmbientRoadTwo: {
    top: '35%',
    left: -70,
    right: 20,
    transform: [{ rotate: '9deg' }],
  },
  createAmbientRoadThree: {
    top: '8%',
    bottom: '28%',
    left: '32%',
    width: 1,
    height: '64%',
    transform: [{ rotate: '12deg' }],
  },
  createAmbientRoadFour: {
    top: '14%',
    bottom: '32%',
    right: '24%',
    width: 1,
    height: '58%',
    transform: [{ rotate: '-10deg' }],
  },
  createVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 190,
    backgroundColor: 'rgba(2, 6, 12, 0.34)',
  },
  createVignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    backgroundColor: 'rgba(2, 6, 12, 0.48)',
  },
  createFormPanel: {
    position: 'absolute',
    top: Platform.OS === 'android' ? CREATE_ANDROID_FORM_TOP : 138,
    left: Platform.OS === 'android' ? 12 : 18,
    right: Platform.OS === 'android' ? 12 : 18,
    borderRadius: 30,
    padding: 12,
    backgroundColor: 'rgba(6, 11, 20, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.17)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 8,
  },
  createUploadBox: {
    borderRadius: 24,
    padding: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  createUploadHeader: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  createUploadLabel: {
    flex: 1,
    color: 'rgba(235, 241, 249, 0.8)',
    fontSize: 13,
    fontWeight: '900',
  },
  createUploadCount: {
    color: 'rgba(235, 241, 249, 0.48)',
    fontSize: 12,
    fontWeight: '900',
  },
  createPhotoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createPhotoThumb: {
    flex: 1,
    height: 52,
    overflow: 'hidden',
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  createPhotoSky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  createPhotoMid: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: 14,
    height: 24,
    borderRadius: 17,
    transform: [{ rotate: '-7deg' }],
  },
  createPhotoGround: {
    position: 'absolute',
    left: -10,
    right: -10,
    bottom: -14,
    height: 38,
    borderRadius: 25,
    transform: [{ rotate: '6deg' }],
  },
  createCategorySection: {
    marginTop: 8,
  },
  createFieldLabel: {
    color: 'rgba(235, 241, 249, 0.58)',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 5,
  },
  createCategoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createCategoryChip: {
    height: 28,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.085)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  createCategoryChipSelected: {
    backgroundColor: 'rgba(139, 158, 139, 0.18)',
  },
  createCategoryIcon: {
    width: 14,
    height: 14,
  },
  createCategoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  createFieldsStack: {
    gap: 5,
    marginTop: 8,
  },
  createInputField: {
    minHeight: 34,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingTop: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  createDetailsField: {
    minHeight: 41,
  },
  createTypedLineTrack: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  createTypedLine: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: 'rgba(235, 241, 249, 0.72)',
  },
  createTypedLineShort: {
    width: '52%',
    height: 5,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: 'rgba(235, 241, 249, 0.38)',
  },
  createButton: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(139, 158, 139, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139, 158, 139, 0.38)',
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  createButtonState: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonStateOverlay: {
    paddingHorizontal: 16,
  },
  createButtonText: {
    color: '#dbe7db',
    fontSize: 15,
    fontWeight: '900',
  },
  createButtonCreatedText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  createFlowDarken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 12, 0.08)',
  },
  copyPanel: {
    width: '100%',
    height: 198,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(5, 10, 18, 0.66)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 8,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 330,
    minHeight: 52,
    color: 'rgba(235, 241, 249, 0.78)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  floatingPrimaryButton: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    marginBottom: 14,
    paddingHorizontal: 24,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#07111f',
    fontSize: 16,
    fontWeight: '900',
  },
});
