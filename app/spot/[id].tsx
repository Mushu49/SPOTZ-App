// filepath: app/spot/[id].tsx

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  findNodeHandle,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FavoriteHeartButton } from '@/components/FavoriteHeartButton';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { useSpots } from '../../src/context/SpotContext';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';
import { getCategoryLabel, PhotoSpot, PublicCreatorProfile, SpotComment, SpotReply } from '../../src/types';
import { getSpotLocationLabel } from '../../src/utils/location';
import { getImageSource, normalizeImageUri, normalizeImageUris, StoredImage } from '../../src/utils/images';
import { openSpotInMaps } from '../../src/utils/maps';
import { ReportModal } from '../../src/components/ReportModal';
import {
  fetchPublicCreatorProfile,
  getPublicCreatorProfileFromUser,
} from '../../src/services/publicProfiles';
import {
  isDuplicateReportError,
  ReportReason,
  ReportTargetType,
  SubmitReportInput,
  submitReport,
} from '../../src/services/reports';

const { width } = Dimensions.get('window');
const COMMENT_MAX_LENGTH = 200;
const COMMENT_INPUT_MIN_HEIGHT = 42;
const COMMENT_INPUT_MAX_HEIGHT = 112;
const COMMENT_KEYBOARD_GAP = 220;

type ActiveReplyTarget = {
  rootCommentId: string;
  parentId: string;
  username: string;
  userId: string;
} | null;

type ActiveReportTarget = {
  targetType: ReportTargetType;
  // targetId is the reported object; targetOwnerId is the creator/author of that object.
  // The reporter is always derived from Firebase Auth inside submitReport.
  targetId: string;
  targetOwnerId?: string | null;
  reviewFields?: Partial<Omit<SubmitReportInput, 'targetType' | 'targetId' | 'targetOwnerId' | 'reason' | 'details'>>;
  title: string;
} | null;

function getCommentAuthorId(item: Pick<SpotComment | SpotReply, 'authorId' | 'userId'>) {
  return item.authorId || item.userId || '';
}

function collectCommentAuthorIds(comments: SpotComment[]) {
  const authorIds = new Set<string>();

  const collectReplyAuthorIds = (replies: SpotReply[] | undefined) => {
    (replies || []).forEach((reply) => {
      const authorId = getCommentAuthorId(reply);
      if (authorId) authorIds.add(authorId);
      collectReplyAuthorIds(reply.replies);
    });
  };

  comments.forEach((comment) => {
    const authorId = getCommentAuthorId(comment);
    if (authorId) authorIds.add(authorId);
    collectReplyAuthorIds(comment.replies);
  });

  return Array.from(authorIds);
}

function isPrivateSpot(spot: PhotoSpot | undefined) {
  return spot?.visibility === 'private' || spot?.isPublic === false;
}

function CommentAvatar({
  imageUri,
  username,
  size,
  isDark,
}: {
  imageUri?: string;
  username: string;
  size: number;
  isDark: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const normalizedImageUri = normalizeImageUri(imageUri);
  const initial = (username || 'P').trim().charAt(0).toUpperCase() || 'P';
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  useEffect(() => {
    setHasImageError(false);
  }, [normalizedImageUri]);

  if (normalizedImageUri && !hasImageError) {
    return (
      <Image
        source={getImageSource(normalizedImageUri)}
        style={[styles.commentAvatar, avatarStyle]}
        resizeMode="cover"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.commentAvatarPlaceholder,
        isDark && styles.commentAvatarPlaceholderDark,
        avatarStyle,
      ]}
    >
      <Text
        style={[
          styles.commentAvatarInitial,
          size >= 40 && styles.creatorAvatarInitial,
          size < 28 && styles.replyAvatarInitial,
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

function CommentLikeButton({
  isLiked,
  likeCount,
  onPress,
  isDark,
}: {
  isLiked: boolean;
  likeCount: number;
  onPress: () => void;
  isDark: boolean;
}) {
  const likeScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 0.86,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
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
      style={styles.commentLikeButton}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? 'Unlike comment' : 'Like comment'}
    >
      <Animated.View style={{ transform: [{ scale: likeScale }] }}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={16}
          color={isLiked ? '#ff3b30' : isDark ? '#a1a1aa' : '#6b7280'}
        />
      </Animated.View>
      <Text
        style={[
          styles.commentLikeCount,
          isDark && styles.textMuted,
          isLiked && styles.commentLikeCountActive,
        ]}
      >
        {likeCount}
      </Text>
    </TouchableOpacity>
  );
}

function DeletableCommentCard({
  children,
  style,
  canDelete,
  onDeletePress,
}: {
  children: React.ReactNode;
  style: any;
  canDelete: boolean;
  onDeletePress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(pressScale, {
        toValue: 0.985,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLongPress = async () => {
    if (!canDelete) return;

    animatePress();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDeletePress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        style={style}
        onLongPress={handleLongPress}
        delayLongPress={350}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function SpotDetailScreen() {
  const { id, from, commentId, replyId } = useLocalSearchParams<{
    id: string;
    from?: string;
    commentId?: string;
    replyId?: string;
  }>();
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const {
    getSpotById,
    toggleFavorite,
    deleteSpot,
    addComment,
    addReply,
    toggleCommentLike,
    toggleReplyLike,
    deleteComment,
    deleteReply,
    getSpotComments,
    favorites,
    user,
    settings,
  } = useSpots();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentInputHeight, setCommentInputHeight] = useState(COMMENT_INPUT_MIN_HEIGHT);
  const [activeReplyTarget, setActiveReplyTarget] = useState<ActiveReplyTarget>(null);
  const [replyText, setReplyText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [creatorProfile, setCreatorProfile] = useState<PublicCreatorProfile | null>(null);
  const [commentAuthorProfiles, setCommentAuthorProfiles] = useState<
    Record<string, PublicCreatorProfile | null>
  >({});
  const [activeReportTarget, setActiveReportTarget] = useState<ActiveReportTarget>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const replyInputRef = useRef<TextInput>(null);
  const focusedInputRef = useRef<React.RefObject<TextInput | null> | null>(null);

  const spot = getSpotById(id || '');
  const isFavorite = id ? favorites.includes(id) : false;
  const spotOwnerId = spot?.creatorId || spot?.createdBy || '';
  const isOwner = !!spotOwnerId && spotOwnerId === user.id;
  const spotIsPrivate = isPrivateSpot(spot);
  const canViewSpot = !!spot && (!spotIsPrivate || isOwner);
  const canManageSpot = isOwner && from === 'profileUploads';
  const canReportSpot = !isOwner;
  const favoriteCount = Math.max(0, Number(spot?.favoriteCount) || 0);
  const favoriteCountLabel = `${favoriteCount} ${favoriteCount === 1 ? 'favorite' : 'favorites'}`;
  const navigationTitle = spot?.title || 'Spot Details';
  const spotComments = useMemo(
    () => (id ? getSpotComments(id) : []),
    [getSpotComments, id]
  );
  const commentsAllowed = spot?.allowComments !== false;
  const canSendComment = commentsAllowed && commentText.trim().length > 0;
  const canSendReply = commentsAllowed && replyText.trim().length > 0;
  const headerHeight = insets.top + 52;
  const scrollBottomPadding = insets.bottom + 96 + keyboardHeight;
  const creatorId = spot?.creatorId || spot?.createdBy || '';
  const creatorUsername =
    creatorProfile?.username ||
    spot?.creatorUsername ||
    (creatorId === user.id ? user.username : 'SPOTZ Creator');
  const creatorDisplayName =
    creatorProfile?.displayName ||
    spot?.creatorDisplayName ||
    spot?.creatorUsername ||
    (creatorId === user.id ? user.displayName || user.username : creatorUsername);
  const canShowCreatorProfileImage =
    creatorId === user.id ||
    creatorProfile?.showProfileImageInComments === true ||
    (!creatorProfile && spot?.creatorShowProfileImageInComments === true);
  const creatorAvatarUrl = canShowCreatorProfileImage
    ? creatorProfile?.profileImageUrl ||
      creatorProfile?.avatarUrl ||
      normalizeImageUri(spot?.creatorAvatarUrl) ||
      (creatorId === user.id ? normalizeImageUri(user.profileImage) : undefined)
    : undefined;

  const scrollInputIntoView = useCallback((inputRef: React.RefObject<TextInput | null>) => {
    focusedInputRef.current = inputRef;

    [80, 260, 520].forEach((delay) => {
      setTimeout(() => {
        const inputNode = findNodeHandle(inputRef.current);
        const scrollResponder = scrollViewRef.current?.getScrollResponder();

        if (inputNode && scrollResponder) {
          scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
            inputNode,
            COMMENT_KEYBOARD_GAP,
            true
          );
        }
      }, delay);
    });
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (event: { endCoordinates?: { height?: number } }) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);

      if (focusedInputRef.current) {
        scrollInputIntoView(focusedInputRef.current);
      }
    };
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
      focusedInputRef.current = null;
    };
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [scrollInputIntoView]);

  useEffect(() => {
    let isMounted = true;

    const resolveCreatorProfile = async () => {
      if (!creatorId) {
        setCreatorProfile(null);
        return;
      }

      if (creatorId === user.id) {
        setCreatorProfile(getPublicCreatorProfileFromUser(user));
        return;
      }

      const profile = await fetchPublicCreatorProfile(creatorId);

      if (isMounted) {
        setCreatorProfile(profile);
      }
    };

    resolveCreatorProfile();

    return () => {
      isMounted = false;
    };
  }, [creatorId, user]);

  useEffect(() => {
    if (from !== 'notifications' || (!commentId && !replyId)) return;

    const scrollTimer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 350);

    return () => clearTimeout(scrollTimer);
  }, [commentId, from, replyId, spotComments.length]);

  useEffect(() => {
    let isMounted = true;
    const authorIds = collectCommentAuthorIds(spotComments);
    const missingAuthorIds = authorIds.filter(
      (authorId) =>
        authorId && authorId !== user.id && !(authorId in commentAuthorProfiles)
    );

    if (missingAuthorIds.length === 0) {
      return () => {
        isMounted = false;
      };
    }

    Promise.all(
      missingAuthorIds.map(async (authorId) => ({
        authorId,
        profile: await fetchPublicCreatorProfile(authorId),
      }))
    ).then((profiles) => {
      if (!isMounted) return;

      setCommentAuthorProfiles((prev) => {
        const nextProfiles = { ...prev };

        profiles.forEach(({ authorId, profile }) => {
          nextProfiles[authorId] = profile;
        });

        return nextProfiles;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [commentAuthorProfiles, spotComments, user.id]);

  const renderSafeHeader = (showOptions = false) => (
    <View
      style={[
        styles.safeHeader,
        { height: headerHeight, paddingTop: insets.top },
        isDark && styles.safeHeaderDark,
      ]}
    >
      <TouchableOpacity
        style={styles.safeHeaderButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons
          name="chevron-back"
          size={28}
          color={isDark ? '#ffffff' : '#000000'}
        />
      </TouchableOpacity>
      <View style={styles.safeHeaderTitleContainer}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.navigationTitle, isDark && styles.navigationTitleDark]}
        >
          {navigationTitle}
        </Text>
      </View>
      <View style={styles.safeHeaderRight}>
        {showOptions && (
          <TouchableOpacity
            style={styles.headerOptionsButton}
            onPress={() => setIsOptionsMenuVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Spot options"
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!spot || !canViewSpot) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
          {renderSafeHeader(false)}
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, isDark && styles.textLight]}>
              Spot not found
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavorite(id);
    }
  };

  const handleOpenInMaps = async () => {
    await openSpotInMaps(spot, settings.defaultMapApp);
  };

  const navigateToProfile = (profileUserId: string) => {
    if (!profileUserId) return;

    if (profileUserId === user.id) {
      router.push('/profile' as any);
      return;
    }

    router.push({ pathname: '/profile/[id]', params: { id: profileUserId } } as any);
  };

  const handleCreatorPress = () => {
    navigateToProfile(creatorId);
  };

  const handleCommentAuthorPress = (authorId: string) => {
    navigateToProfile(authorId);
  };

  const handleCommentChange = (text: string) => {
    setCommentText(text.slice(0, COMMENT_MAX_LENGTH));
  };

  const handleCommentContentSizeChange = (height: number) => {
    const nextHeight = Math.min(
      Math.max(height, COMMENT_INPUT_MIN_HEIGHT),
      COMMENT_INPUT_MAX_HEIGHT
    );

    setCommentInputHeight(nextHeight);
  };

  const handleSendComment = () => {
    if (!commentsAllowed || !canSendComment) return;

    addComment(spot.id, commentText);
    setCommentText('');
    Keyboard.dismiss();
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
  };

  const handleReplyChange = (text: string) => {
    setReplyText(text.slice(0, COMMENT_MAX_LENGTH));
  };

  const handleReplyPress = (
    rootCommentId: string,
    parentId: string,
    username: string,
    userId: string
  ) => {
    if (!commentsAllowed) return;

    setActiveReplyTarget({
      rootCommentId,
      parentId,
      username,
      userId,
    });
    setReplyText('');
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setTimeout(() => replyInputRef.current?.focus(), 180);
    });
  };

  const handleSendReply = () => {
    if (!commentsAllowed || !canSendReply || !activeReplyTarget) return;

    addReply(spot.id, activeReplyTarget.rootCommentId, activeReplyTarget.parentId, replyText);
    setReplyText('');
    setActiveReplyTarget(null);
    Keyboard.dismiss();
  };

  const formatCommentTimestamp = (createdAt: string) => {
    const date = new Date(createdAt);

    return `${date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} at ${date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  };

  const handleDeleteSpot = () => {
    setIsOptionsMenuVisible(false);

    Alert.alert(
      'Delete Spot',
      'Are you sure you want to delete this spot? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const wasDeleted = await deleteSpot(spot.id);

            if (wasDeleted) {
              router.replace('/profile' as any);
            }
          },
        },
      ]
    );
  };

  const openReportTarget = (target: NonNullable<ActiveReportTarget>) => {
    Keyboard.dismiss();
    setIsOptionsMenuVisible(false);
    setActiveReportTarget(target);
  };

  const handleReportSpot = () => {
    if (!canReportSpot) return;

    openReportTarget({
      targetType: 'spot',
      targetId: spot.id,
      targetOwnerId: spotOwnerId || null,
      reviewFields: {
        spotId: spot.id,
        spotTitle: spot.title,
        spotImageUrls: normalizeImageUris(spot.images),
        spotOwnerId: spotOwnerId || null,
        spotOwnerDisplayName: creatorDisplayName,
      },
      title: 'Report Spot',
    });
  };

  const handleSubmitReport = async (reason: ReportReason, details: string) => {
    if (!activeReportTarget) return;

    try {
      await submitReport({
        targetType: activeReportTarget.targetType,
        targetId: activeReportTarget.targetId,
        targetOwnerId: activeReportTarget.targetOwnerId,
        ...activeReportTarget.reviewFields,
        reason,
        details,
      });
      setActiveReportTarget(null);
      Alert.alert('Thanks, your report was submitted.');
    } catch (error) {
      if (isDuplicateReportError(error)) {
        Alert.alert('Report Already Submitted', 'You recently reported this item for the same reason.');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to submit this report right now.';
      Alert.alert('Report Failed', message);
    }
  };

  const handleCommentLongPress = (comment: SpotComment) => {
    const authorId = getCommentAuthorId(comment);

    if (authorId !== user.id) {
      Alert.alert(
        'Comment Options',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report',
            style: 'destructive',
            onPress: () => openReportTarget({
              targetType: 'comment',
              targetId: comment.id,
              targetOwnerId: authorId || null,
              reviewFields: {
                spotId: spot.id,
                spotTitle: spot.title,
                commentId: comment.id,
                commentText: comment.text,
                commentOwnerId: authorId || null,
              },
              title: 'Report Comment',
            }),
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Comment Options',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete this comment?',
              'This will remove the comment and its replies.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const wasDeleted = await deleteComment(spot.id, comment.id);
                    if (!wasDeleted) {
                      Alert.alert('Delete Failed', 'Unable to delete this comment right now.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleReplyLongPress = (commentId: string, reply: SpotReply) => {
    const authorId = getCommentAuthorId(reply);

    if (authorId !== user.id) {
      Alert.alert(
        'Reply Options',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report',
            style: 'destructive',
            onPress: () => openReportTarget({
              targetType: 'reply',
              targetId: reply.id,
              targetOwnerId: authorId || null,
              reviewFields: {
                spotId: spot.id,
                spotTitle: spot.title,
                commentId,
                replyId: reply.id,
                replyText: reply.text,
                replyOwnerId: authorId || null,
              },
              title: 'Report Reply',
            }),
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Reply Options',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete this reply?',
              undefined,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const wasDeleted = await deleteReply(spot.id, commentId, reply.id);
                    if (!wasDeleted) {
                      Alert.alert('Delete Failed', 'Unable to delete this reply right now.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const renderImage = ({ item, index }: { item: StoredImage; index: number }) => (
    <Image
      source={getImageSource(item, undefined, 'detail')}
      style={styles.galleryImage}
      resizeMode="cover"
    />
  );

  const renderAuthorHeader = ({
    userId,
    username,
    profileImageUrl,
    showProfileImageInComments,
    createdAt,
    avatarSize = 28,
    onMenuPress,
  }: {
    userId: string;
    username: string;
    profileImageUrl?: string;
    showProfileImageInComments?: boolean;
    createdAt: string;
    avatarSize?: number;
    onMenuPress?: () => void;
  }) => {
    const authorId = userId;
    const authorProfile = authorId === user.id
      ? getPublicCreatorProfileFromUser(user)
      : commentAuthorProfiles[authorId];
    const resolvedUsername = authorProfile?.username || username || 'Photographer';
    const resolvedDisplayName = authorProfile?.displayName || username || resolvedUsername;
    const canShowProfileImage =
      authorId === user.id
        ? true
        : authorProfile?.showProfileImageInComments ?? showProfileImageInComments ?? false;
    const authorProfileImage =
      authorId === user.id
        ? normalizeImageUri(user.profileImage) || authorProfile?.profileImageUrl || profileImageUrl
        : authorProfile?.profileImageUrl || authorProfile?.avatarUrl || profileImageUrl;
    const visibleProfileImage = canShowProfileImage ? normalizeImageUri(authorProfileImage) : undefined;

    return (
      <View style={styles.commentHeader}>
        <TouchableOpacity
          style={styles.commentAuthor}
          onPress={() => handleCommentAuthorPress(authorId)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${resolvedDisplayName}'s public profile`}
        >
          <CommentAvatar
            imageUri={visibleProfileImage}
            username={resolvedDisplayName}
            size={avatarSize}
            isDark={isDark}
          />
          <Text style={[styles.commentUsername, isDark && styles.textLight]} numberOfLines={1}>
            {resolvedDisplayName}
          </Text>
        </TouchableOpacity>
        <View style={styles.commentHeaderActions}>
          <Text style={[styles.commentTimestamp, isDark && styles.textMuted]} numberOfLines={1}>
            {formatCommentTimestamp(createdAt)}
          </Text>
          {!!onMenuPress && (
            <TouchableOpacity
              style={styles.commentMenuButton}
              onPress={onMenuPress}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Open comment options"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={isDark ? '#a1a1aa' : '#6b7280'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderReplyComposer = (rootCommentId: string, parentId: string) => {
    if (!commentsAllowed) return null;

    const isActive =
      activeReplyTarget?.rootCommentId === rootCommentId &&
      activeReplyTarget?.parentId === parentId;

    if (!isActive) return null;

    return (
      <View style={[styles.replyComposer, isDark && styles.replyComposerDark, isSpotzTheme && styles.surfaceSpotz]}>
        <Text style={[styles.replyingToText, isDark && styles.textMuted]}>
          Replying to @{activeReplyTarget.username}
        </Text>
        <TextInput
          ref={replyInputRef}
          style={[styles.replyInput, isDark && styles.textLight]}
          placeholder="Write a reply..."
          placeholderTextColor={isDark ? '#777777' : '#999999'}
          value={replyText}
          onChangeText={handleReplyChange}
          maxLength={COMMENT_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          returnKeyType="done"
          blurOnSubmit
          autoFocus
          onFocus={() => scrollInputIntoView(replyInputRef)}
          onSubmitEditing={Keyboard.dismiss}
        />
        <View style={styles.commentComposerFooter}>
          <Text style={[styles.commentCounter, isDark && styles.textMuted]}>
            {replyText.length}/{COMMENT_MAX_LENGTH}
          </Text>
          <View style={styles.replyComposerActions}>
            <TouchableOpacity
              style={styles.cancelReplyButton}
              onPress={() => {
                setActiveReplyTarget(null);
                setReplyText('');
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelReplyText, isDark && styles.textMuted]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendCommentButton,
                !canSendReply && styles.sendCommentButtonDisabled,
              ]}
              onPress={handleSendReply}
              disabled={!canSendReply}
              activeOpacity={0.75}
            >
              <Text style={styles.sendCommentText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const flattenReplies = (replies: SpotReply[] | undefined): SpotReply[] => {
    if (!replies || replies.length === 0) return [];

    return replies.flatMap((reply) => [reply, ...flattenReplies(reply.replies)]);
  };

  const renderReplyThread = (
    replies: SpotReply[] | undefined,
    rootCommentId: string
  ): React.ReactNode => {
    const flattenedReplies = flattenReplies(replies);

    if (flattenedReplies.length === 0) return null;

    return (
      <View
        style={[
          styles.repliesList,
          isDark && styles.repliesListDark,
        ]}
      >
        {flattenedReplies.map((reply) => (
          <DeletableCommentCard
            key={reply.id}
            style={[styles.replyCard, isDark && styles.replyCardDark]}
            canDelete={reply.userId === user.id}
            onDeletePress={() =>
              handleReplyLongPress(rootCommentId, reply)
            }
          >
            {renderAuthorHeader({
              userId: getCommentAuthorId(reply),
              username: reply.username,
              profileImageUrl: reply.profileImageUrl,
              showProfileImageInComments: reply.showProfileImageInComments,
              createdAt: reply.createdAt,
              avatarSize: 24,
              onMenuPress: () =>
                handleReplyLongPress(rootCommentId, reply),
            })}
            <View style={styles.commentBodyRow}>
              <View style={styles.replyBodyContent}>
                {!!reply.replyingToUsername && (
                  <Text style={[styles.replyingToPostedText, isDark && styles.textMuted]}>
                    Replying to @{reply.replyingToUsername}
                  </Text>
                )}
                <Text style={[styles.commentBody, isDark && styles.textMuted]}>
                  {reply.text}
                </Text>
              </View>
              <CommentLikeButton
                isLiked={(reply.likedBy || []).includes(user.id)}
                likeCount={reply.likedBy?.length ?? reply.likeCount ?? 0}
                onPress={() => toggleReplyLike(spot.id, rootCommentId, reply.id)}
                isDark={isDark}
              />
            </View>
            {commentsAllowed && (
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => handleReplyPress(rootCommentId, reply.id, reply.username, reply.userId)}
                activeOpacity={0.7}
              >
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
            )}
            {renderReplyComposer(rootCommentId, reply.id)}
          </DeletableCommentCard>
        ))}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {renderSafeHeader(canManageSpot || canReportSpot)}
      <KeyboardAvoidingView
        style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 24}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={Keyboard.dismiss}
          nestedScrollEnabled
        >
        {/* Image Gallery */}
        <View style={styles.galleryContainer}>
          <FlatList
            ref={flatListRef}
            data={spot.images}
            renderItem={renderImage}
            keyExtractor={(item, index) => `${spot.id}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            nestedScrollEnabled
            onScroll={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
          />
          
          {/* Image Counter */}
          <View style={styles.imageCounter} pointerEvents="none">
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {spot.images.length}
            </Text>
          </View>

          {/* Favorite Button */}
          <FavoriteHeartButton isFavorite={isFavorite} onPress={handleToggleFavorite} />
        </View>

        {/* Dot Indicators */}
        <View style={styles.dotContainer} pointerEvents="none">
          {spot.images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentImageIndex === index && styles.dotActive,
                isDark && styles.dotDark,
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title and Category */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, isDark && styles.textLight]}>{spot.title}</Text>
            {isOwner && spotIsPrivate && (
              <View style={[styles.privateBadge, isDark && styles.privateBadgeDark]}>
                <Ionicons name="lock-closed-outline" size={13} color={SPOTZ_BRAND.accent} />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
            <View style={[styles.categoryBadge, isDark && styles.categoryBadgeDark]}>
              <CategoryIcon category={spot.category} size={16} style={styles.categoryIcon} />
              <Text style={[styles.categoryText, isDark && styles.textLight]}>
                {getCategoryLabel(spot.category)}
              </Text>
            </View>
          </View>

          {/* Creator */}
          <View style={[styles.creatorSection, isDark && styles.creatorSectionDark, isSpotzTheme && styles.surfaceSpotz]}>
            <Text style={[styles.creatorLabel, isDark && styles.textMuted]}>Created by</Text>
            <TouchableOpacity
              style={styles.creatorButton}
              onPress={handleCreatorPress}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Open ${creatorDisplayName}'s public profile`}
            >
              <CommentAvatar
                imageUri={creatorAvatarUrl}
                username={creatorDisplayName}
                size={44}
                isDark={isDark}
              />
              <View style={styles.creatorTextGroup}>
                <Text style={[styles.creatorUsername, isDark && styles.textLight]} numberOfLines={1}>
                  {creatorDisplayName}
                </Text>
                {creatorDisplayName !== creatorUsername && (
                  <Text style={[styles.creatorHandle, isDark && styles.textMuted]} numberOfLines={1}>
                    @{creatorUsername}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDark ? '#9ca3af' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Best Time to Shoot */}
          <View style={[styles.infoCard, isDark && styles.infoCardDark, isSpotzTheme && styles.surfaceSpotz]}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⏰</Text>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, isDark && styles.textMuted]}>
                  Best Time to Shoot
                </Text>
                <Text style={[styles.infoValue, isDark && styles.textLight]}>
                  {spot.bestTimeToShoot}
                </Text>
              </View>
            </View>
          </View>

          {isOwner && (
            <View style={[styles.infoCard, isDark && styles.infoCardDark, isSpotzTheme && styles.surfaceSpotz]}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconBadge, isDark && styles.infoIconBadgeDark]}>
                  <Ionicons name="heart" size={18} color="#ff3b30" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, isDark && styles.textMuted]}>
                    Favorites
                  </Text>
                  <Text style={[styles.infoValue, isDark && styles.textLight]}>
                    {favoriteCountLabel}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              About This Spot
            </Text>
            <Text style={[styles.description, isDark && styles.textMuted]}>
              {spot.description}
            </Text>
          </View>

          {/* Location Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              Location
            </Text>
            <View style={[styles.locationCard, isDark && styles.locationCardDark, isSpotzTheme && styles.surfaceSpotz]}>
              <Text style={[styles.coordinates, isDark && styles.textMuted]}>
                📍 {getSpotLocationLabel(spot)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction]}
              onPress={handleOpenInMaps}
            >
              <Text style={styles.actionButtonIcon}>🗺️</Text>
              <Text style={styles.actionButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>

          {/* Comments */}
          <View style={[styles.section, styles.commentsSection]}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              Comments
            </Text>
            {commentsAllowed ? (
              <View style={[styles.commentComposer, isDark && styles.commentComposerDark, isSpotzTheme && styles.surfaceSpotz]}>
                <TextInput
                  ref={commentInputRef}
                  style={[
                    styles.commentInput,
                    { height: commentInputHeight },
                    isDark && styles.textLight,
                  ]}
                  placeholder="Ask a question or leave a comment..."
                  placeholderTextColor={isDark ? '#777777' : '#999999'}
                  value={commentText}
                  onChangeText={handleCommentChange}
                  onContentSizeChange={(event) =>
                    handleCommentContentSizeChange(event.nativeEvent.contentSize.height)
                  }
                  maxLength={COMMENT_MAX_LENGTH}
                  multiline
                  textAlignVertical={commentText.length > 0 ? 'top' : 'center'}
                  returnKeyType="done"
                  blurOnSubmit
                  onFocus={() => scrollInputIntoView(commentInputRef)}
                  onSubmitEditing={Keyboard.dismiss}
                />
                <View style={styles.commentComposerFooter}>
                  <Text style={[styles.commentCounter, isDark && styles.textMuted]}>
                    {commentText.length}/{COMMENT_MAX_LENGTH}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.sendCommentButton,
                      !canSendComment && styles.sendCommentButtonDisabled,
                    ]}
                    onPress={handleSendComment}
                    disabled={!canSendComment}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sendCommentText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.commentsDisabledNotice, isDark && styles.commentsDisabledNoticeDark]}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={isDark ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[styles.commentsDisabledText, isDark && styles.textMuted]}>
                  Comments are disabled for this SPOTZ.
                </Text>
              </View>
            )}

            <View style={styles.commentsList}>
              {spotComments.length > 0 ? (
                spotComments.map((comment) => (
                  <DeletableCommentCard
                    key={comment.id}
                    style={[styles.commentCard, isDark && styles.commentCardDark, isSpotzTheme && styles.surfaceSpotz]}
                    canDelete={comment.userId === user.id}
                    onDeletePress={() => handleCommentLongPress(comment)}
                  >
                    {renderAuthorHeader({
                      userId: getCommentAuthorId(comment),
                      username: comment.username,
                      profileImageUrl: comment.profileImageUrl,
                      showProfileImageInComments: comment.showProfileImageInComments,
                      createdAt: comment.createdAt,
                      onMenuPress: () =>
                        handleCommentLongPress(comment),
                    })}
                    <View style={styles.commentBodyRow}>
                      <Text style={[styles.commentBody, isDark && styles.textMuted]}>
                        {comment.text}
                      </Text>
                      <CommentLikeButton
                        isLiked={(comment.likedBy || []).includes(user.id)}
                        likeCount={comment.likedBy?.length ?? comment.likeCount ?? 0}
                        onPress={() => toggleCommentLike(spot.id, comment.id)}
                        isDark={isDark}
                      />
                    </View>
                    {commentsAllowed && (
                      <TouchableOpacity
                        style={styles.replyButton}
                        onPress={() => handleReplyPress(comment.id, comment.id, comment.username, comment.userId)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.replyButtonText}>Reply</Text>
                      </TouchableOpacity>
                    )}
                    {renderReplyComposer(comment.id, comment.id)}
                    {renderReplyThread(comment.replies, comment.id)}
                  </DeletableCommentCard>
                ))
              ) : (
                <View style={styles.emptyCommentsContainer}>
                  <Text style={[styles.emptyCommentsText, isDark && styles.textMuted]}>
                    No comments yet
                  </Text>
                  <Text style={[styles.emptyCommentsSubtext, isDark && styles.textMuted]}>
                    Be the first to ask a question or leave a review
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {(canManageSpot || canReportSpot) && (
        <Modal
          visible={isOptionsMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOptionsMenuVisible(false)}
        >
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setIsOptionsMenuVisible(false)}
          >
            <Pressable style={[styles.optionsMenu, isDark && styles.optionsMenuDark]}>
              <View style={styles.menuHandle} />
              {canReportSpot && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleReportSpot}
                  activeOpacity={0.75}
                >
                  <Ionicons name="flag-outline" size={20} color="#ff3b30" />
                  <Text style={styles.menuDeleteText}>Report Spot</Text>
                </TouchableOpacity>
              )}
              {canManageSpot && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDeleteSpot}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                  <Text style={styles.menuDeleteText}>Delete Spot</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
      <ReportModal
        visible={!!activeReportTarget}
        isDark={isDark}
        title={activeReportTarget?.title}
        onClose={() => setActiveReportTarget(null)}
        onSubmit={handleSubmitReport}
      />
    </>
  );
}

const styles = StyleSheet.create({
  navigationTitle: {
    maxWidth: width * 0.56,
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  navigationTitleDark: {
    color: '#ffffff',
  },
  safeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
  safeHeaderDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  safeHeaderButton: {
    width: 56,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeHeaderTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  safeHeaderRight: {
    width: 56,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOptionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  containerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  surfaceSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderColor: SPOTZ_THEME.border,
  },
  accentButtonTextSpotz: {
    color: SPOTZ_THEME.accentText,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#000000',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: SPOTZ_BRAND.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryContainer: {
    position: 'relative',
  },
  galleryImage: {
    width: width,
    height: Math.round(width * 9 / 16),
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: SPOTZ_BRAND.accent,
    width: 24,
  },
  dotDark: {
    backgroundColor: '#555',
  },
  content: {
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
  },
  privateBadge: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  privateBadgeDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.18)',
  },
  privateBadgeText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryBadgeDark: {
    backgroundColor: '#333',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
  },
  creatorSection: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  creatorSectionDark: {
    backgroundColor: '#252629',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  creatorLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  creatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  creatorUsername: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  creatorHandle: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  infoCardDark: {
    backgroundColor: '#2a2a2a',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  infoIconBadgeDark: {
    backgroundColor: 'rgba(255, 69, 58, 0.18)',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  section: {
    marginBottom: 20,
  },
  commentsSection: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
  },
  locationCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  locationCardDark: {
    backgroundColor: '#2a2a2a',
  },
  coordinates: {
    fontSize: 14,
    color: '#666666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonDark: {
    backgroundColor: '#333',
  },
  primaryAction: {
    backgroundColor: SPOTZ_BRAND.accent,
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  optionsMenu: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  optionsMenuDark: {
    backgroundColor: '#2a2a2a',
  },
  menuHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c7c7cc',
    marginBottom: 10,
  },
  menuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuDeleteText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  commentComposer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  commentComposerDark: {
    backgroundColor: '#2a2a2a',
  },
  commentsDisabledNotice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: '#f5f5f5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9d9d9',
  },
  commentsDisabledNoticeDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  commentsDisabledText: {
    flex: 1,
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
  },
  commentInput: {
    maxHeight: COMMENT_INPUT_MAX_HEIGHT,
    color: '#000000',
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  commentComposerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  commentCounter: {
    color: '#666666',
    fontSize: 12,
    opacity: 0.75,
  },
  sendCommentButton: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendCommentButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  sendCommentText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 14,
  },
  commentCardDark: {
    backgroundColor: '#2a2a2a',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  commentHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentMenuButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  commentAuthor: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAvatar: {
    backgroundColor: '#d1d5db',
  },
  commentAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e4e7eb',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  commentAvatarPlaceholderDark: {
    backgroundColor: '#3a3a3c',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  commentAvatarInitial: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
  },
  creatorAvatarInitial: {
    fontSize: 18,
  },
  replyAvatarInitial: {
    fontSize: 11,
  },
  commentUsername: {
    flexShrink: 1,
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  commentTimestamp: {
    color: '#666666',
    fontSize: 11,
  },
  commentBody: {
    flex: 1,
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
  },
  replyBodyContent: {
    flex: 1,
  },
  replyingToPostedText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
    opacity: 0.72,
  },
  commentBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentLikeButton: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 1,
    paddingBottom: 2,
  },
  commentLikeCount: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  commentLikeCountActive: {
    color: '#ff3b30',
  },
  replyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  repliesList: {
    marginTop: 12,
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#d9d9d9',
    gap: 10,
  },
  repliesListDark: {
    borderLeftColor: '#444444',
  },
  replyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  replyCardDark: {
    backgroundColor: '#333333',
  },
  replyComposer: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9d9d9',
  },
  replyComposerDark: {
    backgroundColor: '#333333',
    borderColor: '#444444',
  },
  replyingToText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  replyInput: {
    minHeight: 64,
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  replyComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelReplyButton: {
    paddingVertical: 8,
  },
  cancelReplyText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyCommentsText: {
    color: '#666666',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.72,
    textAlign: 'center',
  },
  emptyCommentsSubtext: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.58,
    textAlign: 'center',
    marginTop: 6,
  },
  bottomPadding: {
    height: 40,
  },
});
