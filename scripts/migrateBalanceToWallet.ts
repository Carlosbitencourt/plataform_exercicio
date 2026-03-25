/**
 * Migration Script: balance → freeBalance/lockedBalance/coins
 *
 * Run once via `npx ts-node scripts/migrateBalanceToWallet.ts`
 * (or paste into a Firebase Cloud Function for remote execution)
 *
 * What this does:
 * - Reads every user document from Firestore
 * - If the user has the old 'balance' field and NOT freeBalance yet,
 *   copies balance → freeBalance, sets lockedBalance = 0, coins = 0
 * - Adds 'migrated' flag so the script is idempotent
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Config ────────────────────────────────────────────────────
// Update this path to your service-account JSON or set GOOGLE_APPLICATION_CREDENTIALS env var
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

if (!getApps().length) {
  initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH) });
}

const db = getFirestore();
const USERS_COLLECTION = 'users';
const BATCH_SIZE = 400;

// ── Migration ─────────────────────────────────────────────────
async function migrateUsers() {
  console.log('🚀 Starting balance → freeBalance migration...');

  const snapshot = await db.collection(USERS_COLLECTION).get();
  const docs = snapshot.docs;

  let migrated = 0;
  let skipped = 0;
  let batches = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const data = docSnap.data();

      // Skip already migrated users
      if (data._walletMigrated) {
        skipped++;
        continue;
      }

      // If user has old 'balance' field, migrate it
      const oldBalance = typeof data.balance === 'number' ? data.balance : 0;

      const updates: Record<string, unknown> = {
        freeBalance: data.freeBalance !== undefined ? data.freeBalance : oldBalance,
        lockedBalance: data.lockedBalance !== undefined ? data.lockedBalance : 0,
        coins: data.coins !== undefined ? data.coins : 0,
        _walletMigrated: true,
        _migratedAt: new Date().toISOString(),
      };

      // Optionally keep balance for a while but zero it out to avoid confusion
      if (data.balance !== undefined) {
        updates.balance = null; // explicitly null so it can be cleaned up later
      }

      batch.update(docSnap.ref, updates);
      migrated++;
    }

    await batch.commit();
    batches++;
    console.log(`  📦 Batch ${batches}: processed ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length} users`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped:  ${skipped} (already done)`);
  console.log(`   Total:    ${docs.length}`);
}

migrateUsers().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
