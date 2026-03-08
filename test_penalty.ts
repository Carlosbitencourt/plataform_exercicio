
import { runWeeklyPenaltyCheck } from './services/rewardSystem.ts';
import { db } from './services/firebase.ts';

async function test() {
    console.log("Starting test...");
    try {
        const result = await runWeeklyPenaltyCheck();
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
