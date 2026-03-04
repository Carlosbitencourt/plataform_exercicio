import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    impersonate: (user: any) => void;
    stopImpersonating: () => void;
    isImpersonating: boolean;
    realAdminUser: User | null;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    impersonate: () => { },
    stopImpersonating: () => { },
    isImpersonating: false,
    realAdminUser: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);

            // Check for saved impersonation session
            const saved = sessionStorage.getItem('impersonatedUser');
            if (saved) {
                try {
                    setImpersonatedUser(JSON.parse(saved));
                } catch (e) {
                    console.error("Error parsing impersonated user:", e);
                }
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const impersonate = (user: any) => {
        setImpersonatedUser(user);
        sessionStorage.setItem('impersonatedUser', JSON.stringify(user));
    };

    const stopImpersonating = () => {
        setImpersonatedUser(null);
        sessionStorage.removeItem('impersonatedUser');
    };

    const value = {
        // If impersonating, return a mock user object for the rest of the app
        currentUser: impersonatedUser ? {
            uid: impersonatedUser.id,
            email: impersonatedUser.email,
            displayName: impersonatedUser.name,
            photoURL: impersonatedUser.photoUrl,
            emailVerified: true,
            isAnonymous: false,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => { },
            getIdToken: async () => '',
            getIdTokenResult: async () => ({} as any),
            reload: async () => { },
            toJSON: () => ({}),
            phoneNumber: impersonatedUser.phone || null
        } as unknown as User : currentUser,
        loading,
        impersonate,
        stopImpersonating,
        isImpersonating: !!impersonatedUser,
        realAdminUser: currentUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
