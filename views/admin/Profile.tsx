import React, { useState, useEffect } from 'react';
import { updateProfile, User } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { safeUploadFile } from '../../services/firebaseGuard';
import { Camera, Save, User as UserIcon, Mail, Upload, AlertCircle, CheckCircle } from 'lucide-react';

const Profile: React.FC = () => {
    const { currentUser } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setPhotoUrl(currentUser.photoURL || '');
        }
    }, [currentUser]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        setMessage(null);

        try {
            // Fake progress for better UX as safeUploadFile doesn't provide progress callback yet
            const interval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const downloadURL = await safeUploadFile(file, `profiles/${currentUser?.uid}/${Date.now()}_${file.name}`);

            clearInterval(interval);
            setUploadProgress(100);
            setPhotoUrl(downloadURL);

            // Auto update profile photo
            if (currentUser) {
                await updateProfile(currentUser, { photoURL: downloadURL });
                // Force refresh local state if needed, but currentUser update should trigger
            }

            setTimeout(() => setUploading(false), 500);
            setMessage({ type: 'success', text: 'Foto de perfil atualizada com sucesso!' });

        } catch (error: any) {
            console.error("Error uploading:", error);
            setUploading(false);
            setUploadProgress(0);
            setMessage({ type: 'error', text: `Erro ao enviar foto: ${error.message}` });
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);

        try {
            if (currentUser) {
                await updateProfile(currentUser, {
                    displayName: displayName,
                    photoURL: photoUrl
                });
                setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            }
        } catch (error: any) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: `Erro ao atualizar perfil: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black italic uppercase font-sport text-slate-900 tracking-tighter">
                        Meu <span className="text-lime-600">Perfil</span>
                    </h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
                        Gerencie suas informações de acesso
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[1.25rem] border-2 border-slate-300 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] max-w-2xl mx-auto">
                <div className="p-8">
                    <form onSubmit={handleSaveProfile} className="space-y-8">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="relative group">
                                <div className="w-32 h-32 bg-slate-100 rounded-full border-4 border-slate-200 flex items-center justify-center overflow-hidden shadow-xl">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-12 h-12 text-slate-400" />
                                    )}

                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col z-10">
                                            <span className="text-white text-xs font-bold">{Math.round(uploadProgress)}%</span>
                                            <div className="w-16 h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className="h-full bg-lime-400 transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <label className="absolute bottom-0 right-0 bg-black text-lime-400 p-2.5 rounded-full cursor-pointer hover:bg-zinc-900 hover:scale-110 transition-all shadow-lg border-2 border-white group-hover:bottom-1">
                                    <Camera className="w-5 h-5" />
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                                {uploading ? 'Enviando...' : 'Alterar Foto'}
                            </p>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <UserIcon className="w-3.5 h-3.5" />
                                    Nome de Exibição
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-4 focus:ring-lime-400/20 focus:border-lime-500 outline-none transition-all uppercase placeholder:text-slate-300 text-sm"
                                    placeholder="SEU NOME"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5" />
                                    Email de Acesso
                                </label>
                                <input
                                    type="email"
                                    value={currentUser?.email || ''}
                                    disabled
                                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold outline-none cursor-not-allowed text-sm"
                                />
                                <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                    * O email não pode ser alterado por aqui.
                                </p>
                            </div>
                        </div>

                        {/* Feedback Message */}
                        {message && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success'
                                ? 'bg-lime-50 text-lime-800 border-2 border-lime-200'
                                : 'bg-rose-50 text-rose-800 border-2 border-rose-200'
                                }`}>
                                {message.type === 'success' ? (
                                    <CheckCircle className="w-5 h-5 shrink-0" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                )}
                                <p className="text-xs font-bold uppercase tracking-wide">{message.text}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-4 border-t-2 border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || uploading}
                                className="flex items-center px-8 py-3.5 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group text-xs"
                            >
                                {loading ? (
                                    <span className="animate-pulse">Salvando...</span>
                                ) : (
                                    <span className="flex items-center">
                                        <Save className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                        Salvar Alterações
                                    </span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
