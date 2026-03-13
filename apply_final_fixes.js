
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDIYLFaM7IX1pDUkcvSKKig4Pu0jFyrM6Y",
  authDomain: "app-exercicio-max.firebaseapp.com",
  projectId: "app-exercicio-max",
  storageBucket: "app-exercicio-max.firebasestorage.app",
  messagingSenderId: "421765071196",
  appId: "1:421765071196:web:787567a356a1ea31954199"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  console.log('--- APPLYING FINAL FIXES ---');
  
  // 1. Fix Vinicius
  const vRef = doc(db, 'users', '6G69zd715eTcnOxnyLIQ');
  await updateDoc(vRef, {
    balance: 73.85,
    weeklyMisses: 0
  });
  console.log('Vinicius updated: Balance 73.85, Misses 0');

  // 2. Fix Carlos
  const cRef = doc(db, 'users', 'vMz5zZ8h7UCsCasrhf0J');
  await updateDoc(cRef, {
    weeklyMisses: 2
  });
  console.log('Carlos updated: Misses 2');

  console.log('Done.');
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
