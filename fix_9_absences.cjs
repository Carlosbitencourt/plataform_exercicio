
const admin = require('firebase-admin');
const projectId = 'app-exercicio-max';

if (!admin.apps.length) {
    admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function runFix() {
    const mondayStr = '2026-03-09';
    console.log(`--- ANALYZING PENALTIES SINCE ${mondayStr} ---`);

    try {
        // 1. Get all penalties
        const distsSnap = await db.collection('distributions')
            .where('date', '>=', mondayStr)
            .get();

        const penalties = [];
        distsSnap.forEach(doc => {
            const data = doc.data();
            if (data.amount < 0 && data.reason.includes('FALTA')) {
                penalties.push({ id: doc.id, ...data });
            }
        });

        console.log(`Found ${penalties.length} penalty records this week.`);

        // 2. Get all users mentioned in penalties
        const userIds = [...new Set(penalties.map(p => p.userId))];
        const usersMap = {};
        for (const uid of userIds) {
            const uDoc = await db.collection('users').doc(uid).get();
            if (uDoc.exists) usersMap[uid] = uDoc.data();
        }

        // 3. Get all check-ins for these users this week
        const checkInsSnap = await db.collection('checkIns')
            .where('date', '>=', mondayStr)
            .get();
        
        const checkInsMap = {}; // userId -> Set(dates)
        checkInsSnap.forEach(doc => {
            const data = doc.data();
            if (!checkInsMap[data.userId]) checkInsMap[data.userId] = new Set();
            checkInsMap[data.userId].add(data.date);
        });

        console.log('--- DETAILED AUDIT ---');
        let phantomCount = 0;
        const toDelete = [];

        for (const p of penalties) {
            const user = usersMap[p.userId];
            const userName = user ? user.name : 'Unknown';
            const registrationDate = user?.createdAt ? new Date(user.createdAt) : null;
            if (registrationDate) registrationDate.setHours(0, 0, 0, 0);

            const [y, m, d] = p.date.split('-').map(Number);
            const penaltyDate = new Date(y, m - 1, d);
            penaltyDate.setHours(0, 0, 0, 0);

            let reason = '';
            let isInvalid = false;

            // Check 1: Present that day?
            if (checkInsMap[p.userId]?.has(p.date)) {
                isInvalid = true;
                reason = 'USER WAS PRESENT';
            } 
            // Check 2: Registered after penalty?
            else if (registrationDate && penaltyDate < registrationDate) {
                isInvalid = true;
                reason = `BEFORE REGISTRATION (${user.createdAt.split('T')[0]})`;
            }
            // Check 3: Registered ON same day? (System shouldn't penalize day of join usually)
            else if (registrationDate && penaltyDate.getTime() === registrationDate.getTime()) {
                isInvalid = true;
                reason = `ON REGISTRATION DAY (${user.createdAt.split('T')[0]})`;
            }

            if (isInvalid) {
                phantomCount++;
                console.log(`[INVALID] User: ${userName} | Date: ${p.date} | Reason: ${reason} | ID: ${p.id}`);
                toDelete.push(p);
            } else {
                console.log(`[VALID  ] User: ${userName} | Date: ${p.date}`);
            }
        }

        console.log(`\nResults: ${penalties.length - phantomCount} Valid, ${phantomCount} Phantom.`);
        
        if (toDelete.length > 0) {
            console.log('\n--- DELETING PHANTOM PENALTIES ---');
            for (const p of toDelete) {
                await db.collection('distributions').doc(p.id).delete();
                console.log(`Deleted ${p.id} (${p.date})`);
                
                // Adjust user balance
                const userRef = db.collection('users').doc(p.userId);
                const userDoc = await userRef.get();
                if (userDoc.exists) {
                    const currentBalance = userDoc.data().balance || 0;
                    const dailyPenalty = Math.abs(p.amount);
                    const newBalance = currentBalance + dailyPenalty;
                    const newMisses = Math.max(0, (userDoc.data().weeklyMisses || 0) - 1);
                    
                    await userRef.update({
                        balance: newBalance,
                        weeklyMisses: newMisses
                    });
                    console.log(`Restored R$ ${dailyPenalty} to ${usersMap[p.userId].name}. New balance: ${newBalance}. New misses: ${newMisses}`);
                }
            }
        }

    } catch (err) {
        console.error('Error during fix:', err);
    }
    process.exit(0);
}

runFix();
