import {
  DEMO_SPOT_BATCH_ID,
  DEMO_SPOT_CREATOR_ID,
  commitBatchIfNeeded,
  getAdminFirestore,
  getDemoCreatorDocument,
  getDemoSpotDocument,
  loadDemoSpotItems,
} from './demo-spots-shared.mjs';

const shouldWrite = process.argv.includes('--yes-seed-demo-spots');

async function main() {
  const db = await getAdminFirestore();
  const demoSpots = await loadDemoSpotItems();

  console.log(`Prepared ${demoSpots.length} demo spot document(s).`);
  console.log(`Demo batch: ${DEMO_SPOT_BATCH_ID}`);
  console.log(`Demo creator: ${DEMO_SPOT_CREATOR_ID}`);

  if (!shouldWrite) {
    console.log('Dry run only. Re-run with --yes-seed-demo-spots to write demo data.');
    return;
  }

  const state = {
    batch: db.batch(),
    operationCount: 0,
  };

  state.batch.set(db.collection('users').doc(DEMO_SPOT_CREATOR_ID), getDemoCreatorDocument(), { merge: true });
  state.operationCount += 1;
  state.batch.set(db.collection('publicProfiles').doc(DEMO_SPOT_CREATOR_ID), getDemoCreatorDocument(), { merge: true });
  state.operationCount += 1;

  for (const spot of demoSpots) {
    state.batch.set(db.collection('spots').doc(spot.id), getDemoSpotDocument(spot));
    state.operationCount += 1;

    await commitBatchIfNeeded(db, state);
  }

  await commitBatchIfNeeded(db, state, true);

  console.log(`Seeded ${demoSpots.length} demo spot document(s).`);
}

main().catch((error) => {
  console.error('[DemoSeed] Failed to seed demo spots', error);
  process.exitCode = 1;
});
