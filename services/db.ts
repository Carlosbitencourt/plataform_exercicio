import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
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
import { safeAddDoc, safeUpdateDoc, safeSetDoc, ensureAuth } from './firebaseGuard';
import {
    User, UserStatus, TimeSlot, QRCodeData,
    CheckIn, Distribution, Withdrawal, WithdrawalStatus,
    Notification, Absence, Penalty, Category, Modality, SystemSettings
} from '../types';

// Collections
const USERS_COLLECTION = 'users';
const TIMESLOTS_COLLECTION = 'timeSlots';
const CHECKINS_COLLECTION = 'checkIns';
const DISTRIBUTIONS_COLLECTION = 'distributions';
const QRCODES_COLLECTION = 'qrCodes';
const CATEGORIES_COLLECTION = 'categories';
const WITHDRAWALS_COLLECTION = 'withdrawals';
const NOTIFICATIONS_COLLECTION = 'notifications';
const ABSENCES_COLLECTION = 'absences';
const PENALTIES_COLLECTION = 'penalties';
const SETTINGS_COLLECTION = 'settings';
export const MODALITIES_COLLECTION = 'modalities';

// --- Users ---

export const subscribeToUsers = (callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        callback(users);
    }, (error) => {
        console.error("Error subscribing to users:", error);
        callback([]);
    });
};
/**
 * Verify if a user already exists by email, phone or CPF.
 * Throws specific errors if duplicates are found.
 */
export const checkUserExists = async (email?: string, phone?: string, cpf?: string, excludeUserId?: string) => {
    const usersRef = collection(db, USERS_COLLECTION);
    
    if (email && email.trim()) {
        const qEmail = query(usersRef, where("email", "==", email.trim().toLowerCase()));
        const snapEmail = await getDocs(qEmail);
        const docs = snapEmail.docs.filter(d => d.id !== excludeUserId);
        if (docs.length > 0) throw new Error("Este e-mail já está em uso por outro atleta.");
    }

    if (phone && phone.trim()) {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone) {
            const qPhone = query(usersRef, where("phone", "==", phone.trim()));
            const snapPhone = await getDocs(qPhone);
            const docs = snapPhone.docs.filter(d => d.id !== excludeUserId);
            if (docs.length > 0) throw new Error("Este telefone já está cadastrado em outra conta.");
        }
    }

    if (cpf && cpf.trim()) {
        const qCpf = query(usersRef, where("cpf", "==", cpf.trim()));
        const snapCpf = await getDocs(qCpf);
        const docs = snapCpf.docs.filter(d => d.id !== excludeUserId);
        if (docs.length > 0) throw new Error("Este CPF já está cadastrado no sistema.");
    }
};

/**
 * Checks if a specific field value is already in use by another user.
 * Useful for real-time validation.
 */
export const isFieldDuplicate = async (field: 'email' | 'phone' | 'cpf', value: string, excludeUserId?: string): Promise<string | null> => {
    if (!value || !value.trim()) return null;
    
    const usersRef = collection(db, USERS_COLLECTION);
    let searchValue = value.trim();
    if (field === 'email') searchValue = searchValue.toLowerCase();

    const q = query(usersRef, where(field, "==", searchValue));
    const snap = await getDocs(q);
    const docs = snap.docs.filter(d => d.id !== excludeUserId);

    if (docs.length > 0) {
        if (field === 'email') return "Este e-mail já está em uso.";
        if (field === 'phone') return "Este telefone já está cadastrado.";
        if (field === 'cpf') return "Este CPF já está cadastrado.";
    }
    
    return null;
};

export const addUser = async (userData: Omit<User, 'id' | 'createdAt' | 'status' | 'balance'> & { status?: UserStatus }, customId?: string) => {
    // 1. Prevent duplicates (passing customId if available to avoid self-conflict)
    await checkUserExists(userData.email, userData.phone, userData.cpf, customId);

    const newUser: Omit<User, 'id'> = {
        ...userData,
        balance: 0,
        status: userData.status || UserStatus.PENDING,
        createdAt: new Date().toISOString(),
        photoUrl: userData.photoUrl || ''
    };

    if (customId) {
        await setDoc(doc(db, USERS_COLLECTION, customId), newUser);
    } else {
        await safeAddDoc(USERS_COLLECTION, newUser);
    }
};

export const updateUser = async (user: User) => {
    const { id, ...data } = user;
    await safeUpdateDoc(USERS_COLLECTION, id, data);
};

export const deleteUser = async (id: string) => {
    // 1. Delete all check-ins for this user
    const checkInsQuery = query(collection(db, CHECKINS_COLLECTION), where("userId", "==", id));
    const checkInsSnapshot = await getDocs(checkInsQuery);
    const checkInDeletions = checkInsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(checkInDeletions);

    // 2. Delete all distributions for this user
    const distributionsQuery = query(collection(db, DISTRIBUTIONS_COLLECTION), where("userId", "==", id));
    const distributionsSnapshot = await getDocs(distributionsQuery);
    const distributionDeletions = distributionsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(distributionDeletions);

    // 3. Finally, delete the user
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
    }, (error) => {
        console.error("Error subscribing to time slots:", error);
        callback([]);
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
    }, (error) => {
        console.error("Error subscribing to check-ins:", error);
        callback([]);
    });
};

export const addCheckIn = async (checkInData: Omit<CheckIn, 'id'>) => {
    const checkInRef = await safeAddDoc(CHECKINS_COLLECTION, checkInData);

    // Update user score
    const userRef = doc(db, USERS_COLLECTION, checkInData.userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        await updateDoc(userRef, {
            totalScore: (userData.totalScore || 0) + checkInData.score,
            weeklyScore: (userData.weeklyScore || 0) + checkInData.score
        });
    }

    return checkInRef;
};

export const registerCheckIn = async (checkIn: Omit<CheckIn, 'id'>) => {
    return await addCheckIn(checkIn);
};

export const subscribeToPenalties = (callback: (data: Penalty[]) => void) => {
    const q = query(collection(db, PENALTIES_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const penalties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Penalty));
        callback(penalties);
    }, (error) => {
        console.error("Error subscribing to penalties:", error);
        callback([]);
    });
};

export const subscribeToAbsences = (callback: (data: Absence[]) => void) => {
    const q = query(collection(db, ABSENCES_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const absences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Absence));
        callback(absences);
    }, (error) => {
        console.error("Error subscribing to absences:", error);
        callback([]);
    });
};

export const deleteAbsence = async (id: string) => {
    await deleteDoc(doc(db, ABSENCES_COLLECTION, id));
};

// --- Settings ---

export const subscribeToSettings = (callback: (settings: SystemSettings | null) => void) => {
    // There should only be one settings document, but we'll use 'system' as ID
    return onSnapshot(doc(db, SETTINGS_COLLECTION, 'system'),
        (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as SystemSettings);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error("Error subscribing to settings:", error);
            callback(null); // Ensure loading finishes even on error
        }
    );
};

export const updateSettings = async (settings: Partial<SystemSettings>) => {
    await ensureAuth();
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'system');
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
        await safeUpdateDoc(SETTINGS_COLLECTION, 'system', {
            ...settings,
            lastUpdated: new Date().toISOString()
        });
    } else {
        // Initialize with default if missing
        const newSettings = {
            dailyLossAmount: 5.0,
            welcomeMessage: 'Seja bem-vindo(a) ao Impulso Club, {name}! 🎉 Seu cadastro foi realizado com sucesso. \n\nSeu ID Único de Atleta: *{athleteId}* \n\nUtilize este código para realizar seus check-ins diários. Vamos pra cima! 🔥',
            absenceMessage: 'Olá {name}! 🏋️‍♂️ Notamos que você não realizou seu check-in hoje ({date}). Conforme as regras do Impulso Club, uma penalidade de R$ {penaltyAmount} foi aplicada ao seu saldo. Não desanime, amanhã é um novo dia para treinar! 💪',
            checkInMessage: 'Check-in realizado com sucesso! ✅\n\nAtleta: {name}\nHorário: {time}\n\nBom treino! Continue focado nos seus objetivos. 🚀',
            ...settings,
            lastUpdated: new Date().toISOString()
        };
        await safeSetDoc(SETTINGS_COLLECTION, 'system', newSettings);
    }
};

export const deleteCheckIn = async (id: string) => {
    const checkInRef = doc(db, CHECKINS_COLLECTION, id);
    const checkInSnap = await getDoc(checkInRef);

    if (checkInSnap.exists()) {
        const data = checkInSnap.data() as CheckIn;
        const scoreToRemove = data.score || 0;
        const userId = data.userId;

        // Update user score safely
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            await updateDoc(userRef, {
                totalScore: Math.max(0, (userData.totalScore || 0) - scoreToRemove),
                weeklyScore: Math.max(0, (userData.weeklyScore || 0) - scoreToRemove)
            });
        }

        await deleteDoc(checkInRef);
    }
};

// --- Distributions ---

export const subscribeToDistributions = (callback: (distributions: Distribution[]) => void) => {
    const q = query(collection(db, DISTRIBUTIONS_COLLECTION)); // Removed orderBy to avoid missing index issues on new systems/mobile
    return onSnapshot(q, (snapshot) => {
        const distributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distribution));
        callback(distributions);
    }, (error) => {
        console.error("Error subscribing to distributions:", error);
        callback([]);
    });
};

export const subscribeToUserDistributions = (userId: string, callback: (distributions: Distribution[]) => void) => {
    const q = query(
        collection(db, DISTRIBUTIONS_COLLECTION),
        where("userId", "==", userId)
    );
    return onSnapshot(q, (snapshot) => {
        const distributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distribution));
        callback(distributions);
    }, (error) => {
        console.error("Error subscribing to user distributions:", error);
        callback([]);
    });
};


export const addDistribution = async (distData: Omit<Distribution, 'id'>) => {
    await addDoc(collection(db, DISTRIBUTIONS_COLLECTION), distData);
};

export const deleteDistribution = async (id: string) => {
    const distRef = doc(db, DISTRIBUTIONS_COLLECTION, id);
    const distSnap = await getDoc(distRef);

    if (distSnap.exists()) {
        const data = distSnap.data() as Distribution;
        const amountToRevert = data.amount || 0;
        const userId = data.userId;

        // Revert the balance on the user object
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            await updateDoc(userRef, {
                balance: (userData.balance || 0) - amountToRevert // Subtracting (negative amount) adds it back
            });
        }

        await deleteDoc(distRef);
    }
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
    }, (error) => {
        console.error("Error subscribing to active QR code:", error);
        callback(null);
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
    const q = query(collection(db, CATEGORIES_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        callback(categories);
    }, (error) => {
        console.error("Error subscribing to categories:", error);
        callback([]);
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

// --- Modalities ---

export const subscribeToModalities = (callback: (modalities: Modality[]) => void) => {
    const q = query(collection(db, MODALITIES_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const modalities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Modality));
        callback(modalities);
    }, (error) => {
        console.error("Error subscribing to modalities:", error);
        callback([]);
    });
};

export const addModality = async (modalityData: Omit<Modality, 'id'>) => {
    await safeAddDoc(MODALITIES_COLLECTION, modalityData);
};

export const updateModality = async (modality: Modality) => {
    const { id, ...data } = modality;
    await safeUpdateDoc(MODALITIES_COLLECTION, id, data);
};

export const deleteModality = async (id: string) => {
    await deleteDoc(doc(db, MODALITIES_COLLECTION, id));
};

// --- Withdrawals ---

export const subscribeToWithdrawals = (callback: (withdrawals: Withdrawal[]) => void) => {
    const q = query(collection(db, WITHDRAWALS_COLLECTION), orderBy('requestedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal));
        callback(withdrawals);
    });
};

export const requestWithdrawal = async (userId: string, userName: string, amount: number, pixKey: string) => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("Usuário não encontrado.");
    const userData = userSnap.data() as User;

    if (userData.balance < amount) throw new Error("Saldo insuficiente.");

    // 1. Create withdrawal request
    const withdrawal: Omit<Withdrawal, 'id'> = {
        userId,
        userName,
        amount,
        pixKey,
        status: WithdrawalStatus.PENDING,
        requestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    const withdrawalRef = await safeAddDoc(WITHDRAWALS_COLLECTION, withdrawal);

    // 2. Deduct from balance immediately
    await updateDoc(userRef, {
        balance: parseFloat((userData.balance - amount).toFixed(2))
    });

    return withdrawalRef.id;
};

export const subscribeToUserWithdrawals = (userId: string, callback: (withdrawals: Withdrawal[]) => void) => {
    const q = query(
        collection(db, WITHDRAWALS_COLLECTION),
        where("userId", "==", userId),
        orderBy("requestedAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal));
        callback(withdrawals);
    });
};

export const subscribeToNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("userId", "==", userId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        callback(notifications);
    }, (error) => {
        console.error("Error subscribing to notifications:", error);
        callback([]);
    });
};

export const addNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    try {
        await addDoc(collection(db, "notifications"), {
            userId,
            title,
            message,
            type,
            read: false,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error adding notification:", error);
    }
};

export const updateWithdrawalStatus = async (withdrawal: Withdrawal, status: WithdrawalStatus, rejectionReason?: string) => {
    try {
        const withdrawalRef = doc(db, WITHDRAWALS_COLLECTION, withdrawal.id);
        const updates: any = {
            status,
            processedAt: new Date().toISOString()
        };
        if (rejectionReason) updates.rejectionReason = rejectionReason;

        await updateDoc(withdrawalRef, updates);

        if (status === WithdrawalStatus.APPROVED) {
            await addNotification(
                withdrawal.userId,
                "Transferência Confirmada",
                `Seu PIX no valor de R$ ${withdrawal.amount.toFixed(2)} foi enviado com sucesso!`,
                'success'
            );
        } else if (status === WithdrawalStatus.REJECTED) {
            // Refund balance if rejected
            const userRef = doc(db, USERS_COLLECTION, withdrawal.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                await updateDoc(userRef, {
                    balance: (userData.balance || 0) + withdrawal.amount
                });

                await addNotification(
                    withdrawal.userId,
                    "Solicitação de Resgate Rejeitada",
                    `Seu pedido de resgate de R$ ${withdrawal.amount.toFixed(2)} foi rejeitado. O valor foi estornado ao seu saldo.`,
                    'error'
                );
            }
        }
    } catch (error) {
        console.error("Error updating withdrawal status:", error);
        throw error;
    }
};
