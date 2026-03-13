
const admin = require('firebase-admin');

// Use the project ID from the config
const projectId = 'app-exercicio-max';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: projectId
    });
}

const db = admin.firestore();

async function listDistributions() {
    console.log('--- FETCHING DISTRIBUTIONS SINCE 2026-03-09 ---');
    try {
        const snapshot = await db.collection('distributions')
            .where('date', '>=', '2026-03-09')
            .get();

        console.log(`Found ${snapshot.size} distributions.`);
        
        const penalties = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.amount < 0 && data.reason.includes('FALTA')) {
                penalties.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        console.log(`Found ${penalties.length} penalties.`);
        
        // Group by user
        const byUser = {};
        for (const p of penalties) {
            if (!byUser[p.userId]) byUser[p.userId] = [];
            byUser[p.userId].push(p);
        }

        for (const [userId, userPenalties] of Object.entries(byUser)) {
            console.log(`User ${userId}: ${userPenalties.length} penalties`);
            userPenalties.forEach(p => {
                console.log(`  - ${p.date}: ${p.amount} (${p.reason}) [ID: ${p.id}]`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

listDistributions();
