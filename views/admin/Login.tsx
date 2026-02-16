import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Activity } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin/usuarios');
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
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-4 h-4" />
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
        </form>

        <div className="p-5 bg-black text-center">
          <Link to="/signup" className="text-[10px] text-zinc-500 hover:text-lime-400 uppercase tracking-[0.2em] font-black transition-colors">
            CRIAR NOVA CONTA
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
