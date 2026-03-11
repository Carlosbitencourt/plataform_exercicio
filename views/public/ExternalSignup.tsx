import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Camera, Loader2, User as UserIcon, Phone, CreditCard, MapPin, Upload, UserPlus, ArrowRight, ArrowLeft, CheckCircle2, Activity, QrCode, Copy, ExternalLink, Mail, Check } from 'lucide-react';
import { addUser } from '../../services/db';
import { safeUploadFile } from '../../services/firebaseGuard';
import { auth } from '../../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { sendWelcomeMessage } from '../../services/whatsapp';
import { subscribeToSettings } from '../../services/db';
import { SystemSettings } from '../../types';
import { generateSignupPix } from '../../services/abacatePay';

const ExternalSignup: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser, loading: authLoading } = useAuth();
    const [step, setStep] = useState<'auth' | 'form'>(currentUser ? 'form' : 'auth');
    const [currentSubStep, setCurrentSubStep] = useState(1);
    const [generatedId, setGeneratedId] = useState('');
    const [paymentData, setPaymentData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

    // Efeito para preencher dados quando o usuário logar ou se já estiver logado
    React.useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({
                ...prev,
                name: currentUser.displayName || prev.name,
                email: currentUser.email || prev.email
            }));
            if (step === 'auth') {
                setStep('form');
            }
        }
    }, [currentUser]);

    // Fetch settings for welcome message
    React.useEffect(() => {
        const unsubscribe = subscribeToSettings((data) => {
            if (data) setSystemSettings(data);
        });
        return () => unsubscribe();
    }, []);

    const maskPhone = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    };

    const maskCPF = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        street: '',
        neighborhood: '',
        city: '',
        depositedValue: 30,
        pixKey: '',
        cpf: '',
        photoUrl: ''
    });

    const generateUniqueCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(generatedId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setUploadingPhoto(true);
        try {
            const url = await safeUploadFile(file, `profiles/external/${Date.now()}_${file.name}`);
            setFormData(prev => ({ ...prev, photoUrl: url }));
        } catch (error: any) {
            alert("Erro ao enviar foto: " + error.message);
            setPhotoPreview(null);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const validateStep = (s: number) => {
        if (s === 1) {
            const isNameValid = formData.name.trim().length > 0;
            const isPhoneValid = formData.phone.replace(/\D/g, '').length === 11;
            const isCpfValid = formData.cpf.replace(/\D/g, '').length === 11;
            const isEmailValid = formData.email.includes('@');

            if (!isNameValid || !isPhoneValid || !isCpfValid || !isEmailValid) {
                if (!isCpfValid && formData.cpf.replace(/\D/g, '').length > 0) {
                    setError("O CPF DEVE TER EXATAMENTE 11 NÚMEROS.");
                } else if (!isPhoneValid && formData.phone.replace(/\D/g, '').length > 0) {
                    setError("O WHATSAPP DEVE TER O DDD E O NÚMERO COMPLETO.");
                } else {
                    setError("PREENCHA TODOS OS CAMPOS CORRETAMENTE.");
                }
                return false;
            }
            setError(null);
            return true;
        }
        if (s === 2) {
            return formData.street && formData.neighborhood && formData.city;
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep(currentSubStep)) {
            setCurrentSubStep(prev => prev + 1);
            window.scrollTo(0, 0);
        } else {
            alert("Por favor, preencha todos os campos obrigatórios da etapa atual.");
        }
    };

    const prevStep = () => {
        setCurrentSubStep(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // O useEffect cuidará do redirecionamento e preenchimento
        } catch (error: any) {
            console.error("Error signing in with Google:", error);
            setError("ERRO AO ENTRAR COM GOOGLE: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-lime-400 font-black tracking-widest uppercase">
                <Loader2 className="w-8 h-8 animate-spin mr-3" />
                Carregando...
            </div>
        );
    }

    if (step === 'auth') {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-lime-500/5 blur-[150px] rounded-full"></div>

                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 text-center space-y-8 relative z-10 shadow-2xl">
                    <div className="flex justify-center">
                        <img src="/logo.png" alt="Impulso Club" className="h-20 w-auto object-contain" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black italic uppercase font-sport tracking-tighter">Inscrição de Atleta</h2>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Passo Inicial: Identificação</p>
                    </div>

                    <div className="p-6 bg-zinc-800/30 rounded-[2rem] border border-zinc-800/50 space-y-6">
                        <p className="text-zinc-400 text-xs font-bold leading-relaxed">
                            Para iniciar seu cadastro e garantir a segurança dos seus dados, utilize sua conta do Google.
                        </p>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(255,255,255,0.05)] border-b-4 border-zinc-300"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Entrar com Google
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 p-4 rounded-xl border border-rose-500/50">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const handleCopyPix = async () => {
        if (paymentData?.pix?.payload) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(paymentData.pix.payload);
                } else {
                    // Fallback using textarea
                    const textArea = document.createElement("textarea");
                    textArea.value = paymentData.pix.payload;
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                }
                alert("Código PIX copiado com sucesso! Agora cole no seu aplicativo do banco.");
            } catch (err) {
                console.error('Falha ao copiar:', err);
                alert("Não foi possível copiar automaticamente. Por favor, tente selecionar o código manualmente.");
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.photoUrl) {
            alert("A foto de perfil é obrigatória!");
            return;
        }

        if (!formData.pixKey) {
            alert("A chave PIX é obrigatória!");
            return;
        }

        console.log("SIGNUP: Submitting form...", formData);
        setLoading(true);
        setError(null);

        try {
            const uniqueCode = generateUniqueCode();

            // 1. Salvar usuário no Firestore com status 'analise'
            await addUser({
                ...formData,
                uniqueCode,
                status: 'analise' as any
            } as any, currentUser?.uid);

            setGeneratedId(uniqueCode);

            // 2. Gerar Cobrança no AbacatePay
            try {
                console.log("SIGNUP: Iniciando geração de PIX para", formData.name);
                const billing = await generateSignupPix({
                    name: formData.name,
                    email: currentUser?.email || '',
                    phone: formData.phone,
                    cpf: formData.cpf,
                    amount: formData.depositedValue
                });
                console.log("SIGNUP: PIX gerado com sucesso:", billing);
                setPaymentData(billing);
            } catch (payError: any) {
                console.error("SIGNUP: Erro ao gerar pagamento:", payError);
                // Mostrar erro específico para o usuário para não parecer que "não aconteceu nada"
                alert("Erro ao gerar PIX: " + (payError.message || "Verifique as configurações do AbacatePay no Admin."));
                // Se o pagamento falhar, talvez queiramos interromper ou permitir que o usuário tente novamente
                // Por enquanto, vamos parar o loading para que ele possa clicar de novo.
                setLoading(false);
                return;
            }

            // Enviar mensagem de boas-vindas via WhatsApp
            if (formData.phone) {
                console.log("SIGNUP: Enviando mensagem de boas-vindas para", formData.phone);
                sendWelcomeMessage(formData.phone, formData.name, uniqueCode, systemSettings?.welcomeMessage)
                    .then(res => console.log("SIGNUP: Resultado envio WhatsApp:", res))
                    .catch(err => console.error("SIGNUP: Erro ao enviar boas-vindas WhatsApp:", err));
            }

        } catch (error: any) {
            console.error("Error signing up:", error);
            alert("Erro ao realizar cadastro: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-6 font-sans relative overflow-hidden pb-20">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-lime-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-lime-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

            <div className="max-w-xl mx-auto space-y-8 md:space-y-10 relative z-10">
                {/* Header */}
                <div className="text-center space-y-4 pt-6 md:pt-10">
                    <div className="flex justify-center">
                        <img
                            src="/logo.png"
                            alt="Impulso Club"
                            className="h-16 md:h-20 w-auto object-contain animate-in fade-in zoom-in duration-700"
                        />
                    </div>
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.5em]">Inscrição por Etapas</p>
                </div>

                {/* Step Progress */}
                <div className="flex items-center justify-between px-4 max-w-xs mx-auto">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${currentSubStep === s
                                ? 'bg-lime-400 text-black scale-110 shadow-[0_0_20px_rgba(163,230,53,0.4)]'
                                : currentSubStep > s
                                    ? 'bg-lime-900/50 text-lime-400'
                                    : 'bg-zinc-800 text-zinc-600'
                                }`}>
                                {currentSubStep > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                            </div>
                            {s < 3 && (
                                <div className={`h-1 flex-1 mx-2 rounded-full ${currentSubStep > s ? 'bg-lime-900/50' : 'bg-zinc-800'}`}>
                                    <div className={`h-full bg-lime-400 rounded-full transition-all duration-500 ${currentSubStep > s ? 'w-full' : 'w-0'}`}></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-6 md:p-10">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/50 rounded-2xl animate-in fade-in zoom-in duration-300">
                                    <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin" /> {error}
                                    </p>
                                </div>
                            )}

                            {/* STEP 1: DADOS PESSOAIS */}
                            {currentSubStep === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-black italic font-sport uppercase text-white">1. Seus Dados</h2>
                                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Comece com o básico para te identificarmos.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                            <div className="relative group">
                                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-lime-400 transition-colors" />
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="COMO QUER SER CHAMADO?"
                                                    className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase text-base"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">WhatsApp</label>
                                                <div className="relative group">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-lime-400 transition-colors" />
                                                    <input
                                                        required
                                                        type="tel"
                                                        placeholder="(00) 00000-0000"
                                                        maxLength={15}
                                                        className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none text-base"
                                                        value={formData.phone}
                                                        onChange={e => {
                                                            const maskedValue = maskPhone(e.target.value);
                                                            setFormData({ ...formData, phone: maskedValue });
                                                            if (error) setError(null);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">CPF</label>
                                                <div className="relative group">
                                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-lime-400 transition-colors" />
                                                    <input
                                                        required
                                                        type="text"
                                                        placeholder="000.000.000-00"
                                                        maxLength={14}
                                                        className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none text-base"
                                                        value={formData.cpf}
                                                        onChange={e => {
                                                            const maskedValue = maskCPF(e.target.value);
                                                            setFormData({ ...formData, cpf: maskedValue });
                                                            if (error) setError(null);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-mail</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-lime-400 transition-colors" />
                                                <input
                                                    required
                                                    type="email"
                                                    placeholder="SEU@EMAIL.COM"
                                                    className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase text-base"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: ENDEREÇO */}
                            {currentSubStep === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-black italic font-sport uppercase text-white">2. Localização</h2>
                                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Onde você treina ou reside?</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Rua e Número</label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 group-focus-within:text-lime-400 transition-colors" />
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="RUA, NÚMERO, APTO..."
                                                    className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase text-base"
                                                    value={formData.street}
                                                    onChange={e => setFormData({ ...formData, street: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Bairro</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="BAIRRO"
                                                    className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase text-base"
                                                    value={formData.neighborhood}
                                                    onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Cidade</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="CIDADE"
                                                    className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase text-base"
                                                    value={formData.city}
                                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: INVESTIMENTO E PERFIL / PAYMENT */}
                            {currentSubStep === 3 && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                    {paymentData ? (
                                        // PAGAMENTO INLINE
                                        <div className="space-y-6">
                                            <div className="space-y-2 text-center">
                                                <h2 className="text-xl font-black italic font-sport uppercase text-lime-400">Pagamento PIX</h2>
                                                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Aguardando seu depósito de R$ {formData.depositedValue},00</p>
                                            </div>

                                            <div className="bg-black border-2 border-zinc-800 p-6 rounded-[2rem] space-y-6">
                                                {paymentData?.pix?.qrcode ? (
                                                    <div className="bg-white p-4 rounded-2xl mx-auto w-40 h-40 shadow-xl">
                                                        <img src={paymentData.pix.qrcode} alt="QR Code PIX" className="w-full h-full" />
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-zinc-600 italic text-xs text-center flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Gerando QR Code...
                                                    </div>
                                                )}

                                                <div className="space-y-3">
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyPix}
                                                        className="w-full py-4 bg-zinc-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
                                                    >
                                                        <Copy className="w-4 h-4" /> Copiar Código PIX
                                                    </button>

                                                    {paymentData?.url && (
                                                        <a
                                                            href={paymentData.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full py-4 bg-lime-400/5 text-lime-400 border border-lime-400/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-lime-400/10 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <ExternalLink className="w-4 h-4" /> Abrir no Navegador
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-lime-400/5 border border-lime-400/20 rounded-2xl">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase leading-relaxed text-center">
                                                    Escaneie o QR Code ou copie a chave para realizar o depósito. O sistema identificará automaticamente.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        // FORMULÁRIO STEP 3
                                        <>
                                            <div className="space-y-2 text-center">
                                                <h2 className="text-xl font-black italic font-sport uppercase text-white">3. Finalização</h2>
                                                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Sua foto e investimento de check-in.</p>
                                            </div>

                                            {/* Photo Upload Section */}
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="relative">
                                                    <div
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`relative w-32 h-32 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer overflow-hidden flex items-center justify-center group ${formData.photoUrl
                                                            ? 'border-lime-400 bg-lime-400/5'
                                                            : 'border-zinc-800 bg-zinc-900 hover:border-lime-400/50'
                                                            }`}
                                                    >
                                                        {photoPreview ? (
                                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="text-center space-y-1">
                                                                <Camera className="w-8 h-8 mx-auto text-zinc-700 group-hover:text-lime-400 transition-colors" />
                                                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest group-hover:text-lime-400">Sua Foto</span>
                                                            </div>
                                                        )}

                                                        {uploadingPhoto && (
                                                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                                                <Loader2 className="w-6 h-6 text-lime-400 animate-spin" />
                                                            </div>
                                                        )}

                                                        {formData.photoUrl && (
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Trocar Foto</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!formData.photoUrl && !uploadingPhoto && (
                                                        <div
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="absolute -bottom-2 -right-2 p-2.5 bg-lime-400 rounded-xl shadow-lg transform group-hover:scale-110 transition-transform cursor-pointer border-2 border-black"
                                                        >
                                                            <Upload className="w-4 h-4 text-black" />
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handlePhotoChange}
                                                    accept="image/*"
                                                    hidden
                                                />
                                                <div className="text-center">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                                        {formData.photoUrl ? 'Foto selecionada com sucesso!' : 'Anexe uma foto de rosto nítida (Obrigatório)'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block text-center">Valor do deposito</label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {[30, 40, 50].map(value => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, depositedValue: value })}
                                                                className={`py-3 rounded-xl font-black italic font-sport text-lg transition-all border-2 ${formData.depositedValue === value
                                                                    ? 'bg-lime-400 text-black border-lime-400 scale-[1.05] shadow-[0_0_20px_rgba(163,230,53,0.2)]'
                                                                    : 'bg-black text-zinc-700 border-zinc-800'
                                                                    }`}
                                                            >
                                                                {value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Chave PIX (Para Recebimento)</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        placeholder="CPF, EMAIL OU TELEFONE"
                                                        className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none text-base"
                                                        value={formData.pixKey}
                                                        onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Navigation Buttons */}
                            <div className="pt-4 flex gap-4">
                                {currentSubStep > 1 && !paymentData && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Voltar
                                    </button>
                                )}

                                {currentSubStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-[2] py-5 bg-lime-400 text-black rounded-2xl font-black uppercase tracking-widest text-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 italic font-sport border-b-4 border-lime-600 shadow-xl shadow-lime-900/10"
                                    >
                                        Avançar <ArrowRight className="w-6 h-6" />
                                    </button>
                                ) : paymentData ? (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/analise/${generatedId}`)}
                                        className="flex-1 py-6 bg-lime-400 text-black rounded-2xl font-black text-xl shadow-[0_20px_40px_rgba(163,230,53,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter italic font-sport border-b-4 border-lime-600"
                                    >
                                        <CheckCircle2 className="w-6 h-6" /> Já Paguei
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={loading || uploadingPhoto}
                                        className="flex-[2] py-6 bg-lime-400 text-black rounded-2xl font-black text-xl shadow-[0_20px_40px_rgba(163,230,53,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter italic font-sport border-b-4 border-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><UserPlus className="w-6 h-6" /> Concluir</>}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 pb-4">
                    <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                        <Activity className="w-3 h-3 text-lime-500" />
                        Ação Diária
                    </div>
                    <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                        <CheckCircle2 className="w-3 h-3 text-lime-500" />
                        Recompensa Real
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExternalSignup;
