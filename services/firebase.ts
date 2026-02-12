import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
