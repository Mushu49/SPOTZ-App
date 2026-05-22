import {
  DEMO_SPOT_BATCH_ID,
  DEMO_SPOT_CREATOR_ID,
  commitBatchIfNeeded,
  getAdminFirestore,
  queueDeleteCollectionDocs,
} from './demo-spots-shared.mjs';

const shouldWrite = process.argv.includes('--yes-remove-demo-spots');

async function main() {
  const db = await getAdminFirestore();
  const snapshot = await db.collection('spots').where('isDemo', '==', true).get();

  console.log(`Found ${snapshot.size} demo spot document(s) marked isDemo == true.`);
  console.log(`Demo batch expected for current seed: ${DEMO_SPOT_BATCH_ID}`);

  if (!shouldWrite) {
    console.log('Dry run only. Re-run with --yes-remove-demo-spots to delete demo data.');
    return;
  }

  const state = {
    batch: db.batch(),
    operationCount: 0,
  };

  for (const spotDoc of snapshot.docs) {
    await queueDeleteCollectionDocs(db, state, spotDoc.ref.collection('comments'));
    await queueDeleteCollectionDocs(db, state, spotDoc.ref.collection('likes'));

    state.batch.delete(spotDoc.ref);
    state.operationCount += 1;
    await commitBatchIfNeeded(db, state);
  }

  state.batch.delete(db.collection('publicProfiles').doc(DEMO_SPOT_CREATOR_ID));
  state.operationCount += 1;
  await commitBatchIfNeeded(db, state);

  state.batch.delete(db.collection('users').doc(DEMO_SPOT_CREATOR_ID));
  state.operationCount += 1;
  await commitBatchIfNeeded(db, state, true);

  console.log(`Removed ${snapshot.size} demo spot document(s) and the demo creator profile.`);
}

main().catch((error) => {
  console.error('[DemoRemove] Failed to remove demo spots', error);
  process.exitCode = 1;
});
