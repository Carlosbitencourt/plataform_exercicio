
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'app-exercicio-max'
});

const db = admin.firestore();

async function audit() {
  const mondayStr = '2026-03-09';
  console.log('--- AUDITING VINICIUS AND WEEKLY TOTALS ---');

  // 1. Find Vinicius
  const usersSnap = await db.collection('users').get();
  const vinicius = usersSnap.docs.find(doc => doc.data().name?.toLowerCase().includes('vinicius'));
  
  if (!vinicius) {
    console.log('User Vinicius not found.');
  } else {
    const vId = vinicius.id;
    console.log(`Found Vinicius: ${vinicius.data().name} (${vId})`);

    const vCheckIns = await db.collection('checkIns')
      .where('userId', '==', vId)
      .where('date', '>=', mondayStr)
      .get();
    
    console.log('Check-ins this week:');
    vCheckIns.docs.forEach(doc => console.log(` - ${doc.data().date} at ${doc.data().time}`));

    const vDists = await db.collection('distributions')
      .where('userId', '==', vId)
      .where('date', '>=', mondayStr)
      .get();
    
    console.log('Penalties this week:');
    vDists.docs.forEach(doc => {
        if (doc.data().reason.includes('FALTA')) {
            console.log(` - ${doc.data().date}: ${doc.data().amount} (${doc.data().reason})`);
        }
    });

    // Cross-check: find exact days where dist exists but check-in doesn't
    const checkInDates = new Set(vCheckIns.docs.map(doc => doc.data().date));
    vDists.docs.forEach(doc => {
        const d = doc.data();
        if (d.reason.includes('FALTA') && checkInDates.has(d.date)) {
            console.log(`!!! PHANTOM PENALTY DETECTED: ${d.date} has both check-in and penalty!`);
        }
    });
  }

  // 2. Count total penalties for the week
  const allWeeklyDists = await db.collection('distributions')
    .where('date', '>=', mondayStr)
    .get();
  
  const weeklyFaltas = allWeeklyDists.docs.filter(doc => doc.data().reason.includes('FALTA'));
  console.log(`\nTotal "FALTA" records this week: ${weeklyFaltas.length}`);
  
  const uniquePenaltyUsers = new Set(weeklyFaltas.map(doc => doc.data().userId));
  console.log(`Users with penalties: ${uniquePenaltyUsers.size}`);
}

audit().catch(console.error);
