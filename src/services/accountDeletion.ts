import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';

const DELETED_ACCOUNT_ID = 'deleted-account';
const DELETED_ACCOUNT_NAME = 'Deleted user';
const FIRESTORE_BATCH_LIMIT = 450;

type DeleteBatchState = {
  batch: WriteBatch;
  operationCount: number;
};

function createBatchState(firestore: Firestore): DeleteBatchState {
  return {
    batch: writeBatch(firestore),
    operationCount: 0,
  };
}

async function commitBatchIfNeeded(
  firestore: Firestore,
  state: DeleteBatchState,
  force = false
) {
  if (state.operationCount === 0) return;
  if (!force && state.operationCount < FIRESTORE_BATCH_LIMIT) return;

  await state.batch.commit();
  state.batch = writeBatch(firestore);
  state.operationCount = 0;
}

async function queueDeleteDoc(
  firestore: Firestore,
  state: DeleteBatchState,
  ref: DocumentReference
) {
  state.batch.delete(ref);
  state.operationCount += 1;
  await commitBatchIfNeeded(firestore, state);
}

async function queueUpdateDoc(
  firestore: Firestore,
  state: DeleteBatchState,
  ref: DocumentReference,
  data: Record<string, unknown>
) {
  state.batch.update(ref, data);
  state.operationCount += 1;
  await commitBatchIfNeeded(firestore, state);
}

function getAnonymizedAuthorFields() {
  return {
    authorId: DELETED_ACCOUNT_ID,
    userId: DELETED_ACCOUNT_ID,
    username: DELETED_ACCOUNT_NAME,
    profileImageUrl: '',
    showProfileImageInComments: false,
    authorDeleted: true,
  };
}

function removeUserFromLikedBy(data: Record<string, unknown>, uid: string) {
  if (!Array.isArray(data.likedBy) || !data.likedBy.includes(uid)) {
    return {};
  }

  const nextLikedBy = data.likedBy.filter((userId) => userId !== uid);

  return {
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length,
  };
}

function scrubReply(reply: Record<string, unknown>, uid: string) {
  let changed = false;
  const nextReply: Record<string, unknown> = { ...reply };

  if (reply.userId === uid || reply.authorId === uid) {
    Object.assign(nextReply, getAnonymizedAuthorFields());
    changed = true;
  }

  const likedByUpdate = removeUserFromLikedBy(nextReply, uid);
  if (Object.keys(likedByUpdate).length > 0) {
    Object.assign(nextReply, likedByUpdate);
    changed = true;
  }

  if (reply.replyingToUserId === uid) {
    nextReply.replyingToUserId = DELETED_ACCOUNT_ID;
    nextReply.replyingToUsername = DELETED_ACCOUNT_NAME;
    changed = true;
  }

  if (Array.isArray(reply.replies)) {
    const nextReplies = reply.replies.map((nestedReply) => {
      if (!nestedReply || typeof nestedReply !== 'object') {
        return { reply: nestedReply, changed: false };
      }

      return scrubReply(nestedReply as Record<string, unknown>, uid);
    });

    if (nextReplies.some((item) => item.changed)) {
      nextReply.replies = nextReplies.map((item) => item.reply);
      changed = true;
    }
  }

  return { reply: nextReply, changed };
}

function getScrubbedCommentData(data: Record<string, unknown>, uid: string) {
  let changed = false;
  const updates: Record<string, unknown> = {};

  if (data.userId === uid || data.authorId === uid) {
    Object.assign(updates, getAnonymizedAuthorFields());
    changed = true;
  }

  const likedByUpdate = removeUserFromLikedBy(data, uid);
  if (Object.keys(likedByUpdate).length > 0) {
    Object.assign(updates, likedByUpdate);
    changed = true;
  }

  if (Array.isArray(data.replies)) {
    const nextReplies = data.replies.map((reply) => {
      if (!reply || typeof reply !== 'object') {
        return { reply, changed: false };
      }

      return scrubReply(reply as Record<string, unknown>, uid);
    });

    if (nextReplies.some((item) => item.changed)) {
      updates.replies = nextReplies.map((item) => item.reply);
      changed = true;
    }
  }

  if (changed) {
    updates.updatedAt = serverTimestamp();
  }

  return updates;
}

async function deleteUserFavorites(
  firestore: Firestore,
  state: DeleteBatchState,
  uid: string
) {
  const favoritesSnapshot = await getDocs(collection(firestore, 'users', uid, 'favorites'));

  for (const favoriteSnapshot of favoritesSnapshot.docs) {
    const favoriteData = favoriteSnapshot.data();
    const spotId = typeof favoriteData.spotId === 'string'
      ? favoriteData.spotId
      : favoriteSnapshot.id;
    const spotRef = doc(firestore, 'spots', spotId);
    const spotSnapshot = await getDoc(spotRef);

    if (spotSnapshot.exists()) {
      const spotData = spotSnapshot.data();
      const currentFavoriteCount = Math.max(
        Number(spotData.favoriteCount) || 0,
        Number(spotData.likeCount) || 0
      );
      const nextFavoriteCount = Math.max(0, currentFavoriteCount - 1);

      await queueUpdateDoc(firestore, state, spotRef, {
        favoriteCount: nextFavoriteCount,
        likeCount: nextFavoriteCount,
        updatedAt: serverTimestamp(),
      });
    }

    await queueDeleteDoc(firestore, state, favoriteSnapshot.ref);
  }
}

async function deleteUserPushTokens(
  firestore: Firestore,
  state: DeleteBatchState,
  uid: string
) {
  const tokensSnapshot = await getDocs(collection(firestore, 'users', uid, 'pushTokens'));

  for (const tokenSnapshot of tokensSnapshot.docs) {
    await queueDeleteDoc(firestore, state, tokenSnapshot.ref);
  }
}

async function deleteReceivedNotifications(
  firestore: Firestore,
  state: DeleteBatchState,
  uid: string
) {
  const notificationsSnapshot = await getDocs(
    query(collection(firestore, 'notifications'), where('recipientId', '==', uid))
  );

  for (const notificationSnapshot of notificationsSnapshot.docs) {
    await queueDeleteDoc(firestore, state, notificationSnapshot.ref);
  }
}

async function deleteUsernameReservations(
  firestore: Firestore,
  state: DeleteBatchState,
  uid: string,
  userData: Record<string, unknown>
) {
  const usernameRefs = new Map<string, DocumentReference>();
  const usernameCandidates = [
    userData.normalizedUsername,
    userData.usernameLower,
    userData.username,
  ];

  usernameCandidates.forEach((candidate) => {
    if (typeof candidate !== 'string' || !candidate.trim()) return;
    const normalized = candidate.trim().toLowerCase();
    usernameRefs.set(normalized, doc(firestore, 'usernames', normalized));
  });

  const ownedUsernameSnapshot = await getDocs(
    query(collection(firestore, 'usernames'), where('userId', '==', uid))
  );
  ownedUsernameSnapshot.docs.forEach((usernameSnapshot) => {
    usernameRefs.set(usernameSnapshot.id, usernameSnapshot.ref);
  });

  for (const usernameRef of usernameRefs.values()) {
    const usernameSnapshot = await getDoc(usernameRef);
    if (usernameSnapshot.exists() && usernameSnapshot.data().userId === uid) {
      await queueDeleteDoc(firestore, state, usernameRef);
    }
  }
}

async function scrubSpotsAndComments(
  firestore: Firestore,
  state: DeleteBatchState,
  uid: string
) {
  const spotsSnapshot = await getDocs(collection(firestore, 'spots'));

  for (const spotSnapshot of spotsSnapshot.docs) {
    const spotData = spotSnapshot.data();
    const isUserSpot =
      spotData.createdBy === uid ||
      spotData.creatorId === uid ||
      spotData.ownerId === uid;

    if (isUserSpot) {
      await queueUpdateDoc(firestore, state, spotSnapshot.ref, {
        createdBy: DELETED_ACCOUNT_ID,
        creatorId: DELETED_ACCOUNT_ID,
        ownerId: DELETED_ACCOUNT_ID,
        creatorUsername: DELETED_ACCOUNT_NAME,
        creatorDisplayName: DELETED_ACCOUNT_NAME,
        creatorAvatarUrl: '',
        creatorShowProfileImageInComments: false,
        ownerDeleted: true,
        updatedAt: serverTimestamp(),
      });
    }

    const commentsSnapshot = await getDocs(
      collection(firestore, 'spots', spotSnapshot.id, 'comments')
    );

    for (const commentSnapshot of commentsSnapshot.docs) {
      const commentUpdates = getScrubbedCommentData(commentSnapshot.data(), uid);

      if (Object.keys(commentUpdates).length > 0) {
        await queueUpdateDoc(firestore, state, commentSnapshot.ref, commentUpdates);
      }
    }
  }
}

export async function deleteAccountData(firestore: Firestore, uid: string) {
  const batchState = createBatchState(firestore);
  const userRef = doc(firestore, 'users', uid);
  const publicProfileRef = doc(firestore, 'publicProfiles', uid);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};

  await deleteUserFavorites(firestore, batchState, uid);
  await deleteUserPushTokens(firestore, batchState, uid);
  await deleteReceivedNotifications(firestore, batchState, uid);
  await deleteUsernameReservations(firestore, batchState, uid, userData);
  await scrubSpotsAndComments(firestore, batchState, uid);

  if (userSnapshot.exists()) {
    await queueDeleteDoc(firestore, batchState, userRef);
  } else {
    await deleteDoc(userRef).catch(() => undefined);
  }
  await queueDeleteDoc(firestore, batchState, publicProfileRef);

  await commitBatchIfNeeded(firestore, batchState, true);
}
