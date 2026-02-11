import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, UserPlus, AlertCircle, Activity } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';

const Signup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            navigate('/admin/usuarios');
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('ESTE EMAIL JÁ ESTÁ EM USO.');
            } else if (err.code === 'auth/weak-password') {
                setError('A SENHA DEVE TER PELO MENOS 6 CARACTERES.');
            } else {
                setError('ERRO AO CRIAR CONTA: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-6 relative overflow-hidden">
            {/* Luz Neon de Fundo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-lime-500/5 blur-[150px] rounded-full"></div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden relative z-10">
                <div className="p-12 bg-zinc-800/30 text-center space-y-4 border-b border-zinc-800">
                    <div className="inline-flex p-5 bg-lime-400 rounded-[1.5rem] mb-2 shadow-[0_0_40px_rgba(163,230,53,0.4)] animate-pulse-lime">
                        <Activity className="w-10 h-10 text-black" />
                    </div>
                    <h1 className="text-4xl font-black italic tracking-tighter text-white font-sport uppercase">
                        Fit<span className="text-lime-400">Reward</span>
                    </h1>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Novo Acesso</p>
                </div>

                <form onSubmit={handleSignup} className="p-12 space-y-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3 ml-1">Email</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-14 pr-6 py-5 bg-black border border-zinc-800 rounded-2xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest"
                                    placeholder="SEU EMAIL"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3 ml-1">Senha</label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-14 pr-6 py-5 bg-black border border-zinc-800 rounded-2xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center text-white text-[10px] bg-red-600 p-4 rounded-xl font-black uppercase tracking-widest">
                            <AlertCircle className="w-4 h-4 mr-3 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-6 bg-lime-400 text-black rounded-[1.5rem] font-black text-xl shadow-[0_15px_35px_rgba(163,230,53,0.3)] hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter italic font-sport"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                        ) : (
                            <>
                                <UserPlus className="w-6 h-6" />
                                Criar Conta
                            </>
                        )}
                    </button>
                </form>

                <div className="p-5 bg-black text-center">
                    <Link to="/admin/login" className="text-[10px] text-zinc-500 hover:text-lime-400 uppercase tracking-[0.2em] font-black transition-colors">
                        JÁ TEM UMA CONTA? LOGIN
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
