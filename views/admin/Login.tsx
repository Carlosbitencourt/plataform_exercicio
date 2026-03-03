import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User as UserIcon, LogIn, AlertCircle, Activity } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { subscribeToUsers } from '../../services/db';
import { User } from '../../types';
import { ADMIN_EMAILS } from '../../constants';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = subscribeToUsers(setAthletes);
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = result.user.email;

      const isAdmin = ADMIN_EMAILS.includes(userEmail || '');

      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/checkin');
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('CREDENCIAIS INVÁLIDAS.');
      } else {
        setError('ERRO AO FAZER LOGIN: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email;

      // Check if user is an admin
      const isAdmin = ADMIN_EMAILS.includes(userEmail || '');

      if (isAdmin) {
        navigate('/admin');
      } else {
        // Check if user is an athlete
        const isAthlete = athletes.some(a => a.email?.toLowerCase() === userEmail?.toLowerCase());
        if (isAthlete) {
          navigate('/checkin');
        } else {
          // If neither, send to signup
          navigate('/inscrever');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError('DOMÍNIO NÃO AUTORIZADO NO FIREBASE. ADICIONE AO CONSOLE.');
      } else {
        setError('ERRO AO FAZER LOGIN COM GOOGLE: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6 relative overflow-hidden">
      {/* Luz Neon de Fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-lime-500/5 blur-[150px] rounded-full"></div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden relative z-10">
        <div className="p-8 bg-zinc-800/30 text-center space-y-3 border-b border-zinc-800 flex flex-col items-center">
          <img src="/logo.png" alt="Impulso Club" className="h-20 w-auto object-contain mb-2" />
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em]">Controle Central</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2 ml-1">Email</label>
              <div className="relative group">
                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-4 h-4" />
                <input
                  type="email"
                  required
                  className="w-full pl-12 pr-5 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest text-sm"
                  placeholder="SEU EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2 ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-4 h-4" />
                <input
                  type="password"
                  required
                  className="w-full pl-12 pr-5 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest text-sm"
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
            className="w-full py-4 bg-lime-400 text-black rounded-[1.2rem] font-black text-lg shadow-[0_10px_25px_rgba(163,230,53,0.3)] hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter italic font-sport"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Acessar Portal
              </>
            )}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.3em]">
              <span className="bg-zinc-900 px-4 text-zinc-500">Ou continue com</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-[1.2rem] font-black text-sm shadow-[0_10px_25px_rgba(255,255,255,0.05)] hover:bg-zinc-100 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest font-sport"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
        </form>

        <div className="p-5 bg-black text-center border-t border-zinc-800/50">
          <Link to="/inscrever" className="text-[10px] text-zinc-500 hover:text-lime-400 uppercase tracking-[0.2em] font-black transition-colors">
            NÃO TEM CONTA? CADASTRE-SE AGORA
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
