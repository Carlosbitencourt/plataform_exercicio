
import { auth, db, storage } from './firebase';
import {
    signInAnonymously,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    DocumentReference,
    DocumentData
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'firebase/storage';
import { getUserLocation as getGeoLocation, LocationResult, LocationError } from './geolocation';

// --- Authentication ---

export const ensureAuth = (): Promise<FirebaseUser> => {
    return new Promise((resolve, reject) => {
        // 1. Check if already authenticated
        if (auth.currentUser) {
            console.log("GUARD: Already authenticated", auth.currentUser.uid);
            resolve(auth.currentUser);
            return;
        }

        console.log("GUARD: Starting anonymous auth...");

        // 2. Set Persistence & Sign In
        setPersistence(auth, browserLocalPersistence)
            .then(() => {
                return signInAnonymously(auth);
            })
            .then((userCredential) => {
                console.log("GUARD: Signed in anonymously", userCredential.user.uid);
                resolve(userCredential.user);
            })
            .catch((error) => {
                console.error("GUARD: Auth failed", error);
                reject(error);
            });
    });
};

// --- Geolocation ---

export const ensureLocationPermission = async (): Promise<boolean> => {
    // Basic check - actual request happens in getUserLocation
    // This is mostly for UI feedback if needed beforehand
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            return result.state === 'granted' || result.state === 'prompt';
        } catch {
            return true; // Assume true if query fails, let getUserLocation handle it
        }
    }
    return true;
};

export const getUserLocation = async (): Promise<LocationResult> => {
    return await getGeoLocation();
};

// --- Firestore Operations ---

const logOperation = (op: string, path: string, data?: any) => {
    console.group(`🔥 FIREBASE GUARD: ${op}`);
    console.log("AUTH UID:", auth.currentUser?.uid || '⚠️ UNANTENTICATED');
    console.log("PATH:", path);
    if (data) console.log("DATA:", data);
    console.groupEnd();
};

export const safeAddDoc = async (
    collectionPath: string,
    data: DocumentData
): Promise<DocumentReference> => {
    await ensureAuth();
    logOperation('addDoc', collectionPath, data);
    return await addDoc(collection(db, collectionPath), data);
};

export const safeUpdateDoc = async (
    collectionPath: string,
    docId: string,
    data: DocumentData
): Promise<void> => {
    await ensureAuth();
    const fullPath = `${collectionPath}/${docId}`;
    logOperation('updateDoc', fullPath, data);
    const docRef = doc(db, collectionPath, docId);
    return await updateDoc(docRef, data);
};

// --- Storage Operations ---

export const safeUploadFile = async (
    file: File,
    customPath?: string
): Promise<string> => {
    const user = await ensureAuth();

    // Validate
    if (!file.type.startsWith('image/')) {
        throw new Error("Apenas imagens são permitidas.");
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
        throw new Error("A imagem deve ter no máximo 5MB.");
    }

    const path = customPath || `uploads/${user.uid}/${Date.now()}_${file.name}`;
    logOperation('uploadBytes', path, { size: file.size, type: file.type });

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};
