
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDIYLFaM7IX1pDUkcvSKKig4Pu0jFyrM6Y",
  authDomain: "app-exercicio-max.firebaseapp.com",
  projectId: "app-exercicio-max",
  storageBucket: "app-exercicio-max.firebasestorage.app",
  messagingSenderId: "421765071196",
  appId: "1:421765071196:web:787567a356a1ea31954199",
  measurementId: "G-CVDFKJGE2H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const categories = [
    { name: 'Academia', icon: 'Dumbbell', color: '#bef264' },
    { name: 'Caminhada', icon: 'Footprints', color: '#bef264' },
    { name: 'Corrida', icon: 'Zap', color: '#bef264' }
];

async function seed() {
    console.log("Starting seed...");
    const categoriesRef = collection(db, "categories");
    
    for (const cat of categories) {
        const q = query(categoriesRef, where("name", "==", cat.name));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            await addDoc(categoriesRef, cat);
            console.log(`Added category: ${cat.name}`);
        } else {
            console.log(`Category already exists: ${cat.name}`);
        }
    }
}

seed().then(() => {
    console.log("Seed finished.");
    process.exit(0);
}).catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
});
