import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, MapPin, User as UserIcon, LogOut, Bell, Menu, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth as firebaseAuth } from '../services/firebase';
import { subscribeToUsers } from '../services/db';
import { User, UserStatus } from '../types';

interface AppShellProps {
    children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
    const { currentUser, isImpersonating, stopImpersonating } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const [userData, setUserData] = useState<User | null>(null);

    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/ranking')) setActiveTab('ranking');
        else if (path.includes('/locais')) setActiveTab('locais');
        else if (path.includes('/perfil')) setActiveTab('perfil');
        else setActiveTab('home');
    }, [location]);

    useEffect(() => {
        if (!currentUser?.email) return;

        return subscribeToUsers((users) => {
            const found = users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
            if (found) setUserData(found);
        });
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await firebaseAuth.signOut();
            navigate('/admin/login');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const tabs = [
        { id: 'home', icon: Home, label: 'Início', path: '/checkin' },
        { id: 'ranking', icon: Trophy, label: 'Ranking', path: '/ranking' },
        { id: 'locais', icon: MapPin, label: 'Locais', path: '/locais' },
        { id: 'perfil', icon: UserIcon, label: 'Perfil', path: '/perfil/atleta' },
    ];

    // Don't show shell on login/signup pages
    const isAuthPage = location.pathname === '/admin/login' || location.pathname === '/inscrever';
    if (isAuthPage) return <>{children}</>;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-x-hidden">
            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="bg-rose-600 px-6 py-2 flex items-center justify-between sticky top-0 z-[100] animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                            Modo Visualização: <span className="opacity-80">{userData?.name || currentUser?.displayName}</span>
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            stopImpersonating();
                            navigate('/admin/usuarios');
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        Encerrar
                    </button>
                </div>
            )}

            {/* Premium Header */}
            <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 group">
                            {userData?.photoUrl || currentUser?.photoURL ? (
                                <img src={userData?.photoUrl || currentUser?.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-lime-400 font-bold text-xs">
                                    {userData?.name?.[0] || currentUser?.displayName?.[0] || 'A'}
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-lime-500 border-2 border-black rounded-full shadow-[0_0_10px_rgba(163,230,53,0.5)]"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest leading-none mb-1">Bem-vindo</span>
                        <span className="text-sm font-black italic font-sport tracking-tight text-white uppercase truncate max-w-[120px]">
                            {userData?.name?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Atleta'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-400 hover:text-lime-400 transition-all active:scale-90">
                        <Bell className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-400 hover:text-rose-500 transition-all active:scale-90"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 pb-32 animate-in fade-in duration-500 relative">
                {userData?.status === UserStatus.PENDING && (
                    <div className="fixed top-24 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
                        <div className="bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800 p-6 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] max-w-sm w-full space-y-4 animate-in slide-in-from-top-12 duration-700 pointer-events-auto border-t-amber-500/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex items-center justify-center shrink-0">
                                    <Bell className="w-6 h-6 text-amber-500 animate-bounce" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-lg font-black italic font-sport text-white uppercase tracking-tighter leading-none">Conta em Análise</h2>
                                    <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-widest leading-relaxed">
                                        As funcionalidades serão liberadas após aprovação.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                                    <span className="text-[7px] font-black text-amber-500 uppercase tracking-[0.2em]">Aguardando Aprovação</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {children}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-6 left-6 right-6 z-50">
                <div className="bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] p-2 flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.path)}
                                className={`relative flex flex-col items-center gap-1 py-2 px-6 rounded-3xl transition-all duration-300 ${isActive ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-lime-400 rounded-full shadow-[0_0_20px_rgba(163,230,53,0.4)] animate-in zoom-in duration-300"></div>
                                )}
                                <Icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                                <span className={`text-[9px] font-black uppercase tracking-widest relative z-10 ${isActive ? 'opacity-100' : 'opacity-0 h-0 w-0 overflow-hidden'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default AppShell;
