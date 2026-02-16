import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    addDoc,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';
import { safeAddDoc, safeUpdateDoc } from './firebaseGuard';
import { User, TimeSlot, CheckIn, Distribution, QRCodeData, UserStatus, Category } from '../types';

// Collections
const USERS_COLLECTION = 'users';
const TIMESLOTS_COLLECTION = 'timeSlots';
const CHECKINS_COLLECTION = 'checkIns';
const DISTRIBUTIONS_COLLECTION = 'distributions';
const QRCODES_COLLECTION = 'qrCodes';
const CATEGORIES_COLLECTION = 'categories';

// --- Users ---

export const subscribeToUsers = (callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        callback(users);
    });
};

export const addUser = async (userData: Omit<User, 'id' | 'createdAt' | 'status' | 'balance'> & { status?: UserStatus }) => {
    const newUser: Omit<User, 'id'> = {
        ...userData,
        balance: userData.depositedValue,
        status: userData.status || UserStatus.PENDING,
        createdAt: new Date().toISOString(),
        photoUrl: userData.photoUrl || ''
    };

    await safeAddDoc(USERS_COLLECTION, newUser);
};

export const updateUser = async (user: User) => {
    const { id, ...data } = user;
    await safeUpdateDoc(USERS_COLLECTION, id, data);
};

export const deleteUser = async (id: string) => {
    await deleteDoc(doc(db, USERS_COLLECTION, id));
};

export const getUserById = async (id: string) => {
    // Implementation if needed, mostly used within other queries
};


// --- TimeSlots ---

export const subscribeToTimeSlots = (callback: (slots: TimeSlot[]) => void) => {
    const q = query(collection(db, TIMESLOTS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeSlot));
        callback(slots);
    });
};

export const addTimeSlot = async (slotData: Omit<TimeSlot, 'id'>) => {
    await safeAddDoc(TIMESLOTS_COLLECTION, slotData);
};

export const deleteTimeSlot = async (id: string) => {
    await deleteDoc(doc(db, TIMESLOTS_COLLECTION, id));
};

export const updateTimeSlot = async (timeSlot: TimeSlot) => {
    const slotRef = doc(db, TIMESLOTS_COLLECTION, timeSlot.id);
    const { id, ...data } = timeSlot;
    await updateDoc(slotRef, data as any);
};


// --- CheckIns ---

export const subscribeToCheckIns = (callback: (checkIns: CheckIn[]) => void) => {
    const q = query(collection(db, CHECKINS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const checkIns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
        callback(checkIns);
    });
};

export const addCheckIn = async (checkInData: Omit<CheckIn, 'id'>) => {
    await safeAddDoc(CHECKINS_COLLECTION, checkInData);
};

export const deleteCheckIn = async (id: string) => {
    await deleteDoc(doc(db, CHECKINS_COLLECTION, id));
};

// --- Distributions ---

export const subscribeToDistributions = (callback: (distributions: Distribution[]) => void) => {
    const q = query(collection(db, DISTRIBUTIONS_COLLECTION), orderBy('date', 'asc')); // Order might need adjustment based on date string format
    return onSnapshot(q, (snapshot) => {
        const distributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distribution));
        callback(distributions);
    });
};


export const addDistribution = async (distData: Omit<Distribution, 'id'>) => {
    await addDoc(collection(db, DISTRIBUTIONS_COLLECTION), distData);
};


// --- QR Codes ---

export const getTodayActiveQRCode = (callback: (qr: QRCodeData | null) => void) => {
    const today = new Date().toLocaleDateString('pt-BR');
    // Note: Storing date as DD/MM/YYYY might be problematic for sorting, but good for equality checks if consistent.
    // Ideally use ISO YYYY-MM-DD. existing storage used getLocalDate() which returned YYYY-MM-DD probably? 
    // Let's stick to YYYY-MM-DD for storage to be safe.

    // Actually the existing `getLocalDate` in `storage.ts` (which we can't see but assuming standard) usually does YYYY-MM-DD.
    // Let's implement a helper here to be consistent.
    const getISODate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const d = getISODate();

    const q = query(collection(db, QRCODES_COLLECTION), where("date", "==", d), where("active", "==", true), limit(1));
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as QRCodeData);
        } else {
            callback(null);
        }
    });
};


export const createDailyQRCode = async () => {
    const getISODate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const today = getISODate();

    // Deactivate previous QRs for today if any (just cleanup)
    // In a real app we might want to ensure only one is active via backend logic or rules.

    const newQR: Omit<QRCodeData, 'id'> = {
        date: today,
        token: Math.random().toString(36).substring(2, 10).toUpperCase(),
        active: true,
        createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, QRCODES_COLLECTION), newQR);
    return newQR;

};

// --- Categories ---

export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        callback(categories);
    });
};

export const addCategory = async (categoryData: Omit<Category, 'id'>) => {
    await safeAddDoc(CATEGORIES_COLLECTION, categoryData);
};

export const updateCategory = async (category: Category) => {
    const { id, ...data } = category;
    await safeUpdateDoc(CATEGORIES_COLLECTION, id, data);
};

export const deleteCategory = async (id: string) => {
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
};
