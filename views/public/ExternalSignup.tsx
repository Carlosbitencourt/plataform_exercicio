import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, UserStatus, SystemSettings } from '../../types';
import { subscribeToSettings } from '../../services/db';
import { Loader2, Check, User as UserIcon, Mail, Phone, MapPin, Camera, Zap, Copy, ExternalLink, QrCode, ArrowLeft, ArrowRight, UserPlus, Upload, Activity, CheckCircle2, CreditCard, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateSignupPix } from '../../services/abacatePay';
import { generatePixPayload, createDepositRequest } from '../../services/manualPix';
import { db } from '../../services/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth } from '../../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { addUser, isFieldDuplicate } from '../../services/db';
import { safeUploadFile } from '../../services/firebaseGuard';
import { sendWelcomeMessage } from '../../services/whatsapp';
import { QRCodeSVG } from 'qrcode.react';

const ExternalSignup: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser, loading: authLoading } = useAuth();
    const [step, setStep] = useState<'auth' | 'form'>(() => {
        const saved = localStorage.getItem('signup_step');
        if (saved) return saved as 'auth' | 'form';
        return currentUser ? 'form' : 'auth';
    });
    const [currentSubStep, setCurrentSubStep] = useState(() => {
        const saved = localStorage.getItem('signup_currentSubStep');
        return saved ? parseInt(saved) : 1;
    });
    const [generatedId, setGeneratedId] = useState(() => localStorage.getItem('signup_generatedId') || '');
    const [paymentData, setPaymentData] = useState<any>(() => {
        const saved = localStorage.getItem('signup_paymentData');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const [balanceBeforePayment, setBalanceBeforePayment] = useState<number | null>(null);
    const [manualPixConfig, setManualPixConfig] = useState<{ enabled: boolean; pixKey: string; recipientName: string } | null>(null);
    const [manualPixPayload, setManualPixPayload] = useState<string | null>(null);
    const [depositPending, setDepositPending] = useState(false); // waiting for admin approval
    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem('signup_formData');
        return saved ? JSON.parse(saved) : {
            name: '',
            email: '',
            phone: '',
            cpf: '',
            street: '',
            neighborhood: '',
            city: '',
            photoUrl: '',
            pixKey: '',
            depositedValue: ''
        };
    });
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; cpf?: string }>({});
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);

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

    // Load integrations config (manual PIX)
    React.useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'integrations'));
                if (snap.exists() && snap.data().manualPix?.enabled) {
                    setManualPixConfig(snap.data().manualPix);
                }
            } catch (e) {
                console.error('Failed to load integrations config', e);
            }
        };
        load();
    }, []);

    // Persist signup state
    React.useEffect(() => {
        localStorage.setItem('signup_step', step);
        localStorage.setItem('signup_currentSubStep', String(currentSubStep));
        localStorage.setItem('signup_generatedId', generatedId);
        if (paymentData) {
            localStorage.setItem('signup_paymentData', JSON.stringify(paymentData));
        } else {
            localStorage.removeItem('signup_paymentData');
        }
        localStorage.setItem('signup_formData', JSON.stringify(formData));
    }, [step, currentSubStep, generatedId, paymentData, formData]);

    // Monitor payment status via user BALANCE in real-time - only confirms when PIX is actually paid
    React.useEffect(() => {
        if (!currentUser?.uid || !paymentData) return; // Only listen if payment was generated

        const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap: any) => {
            if (snap.exists()) {
                const userData = snap.data();
                const currentBalance = userData.balance || 0;

                // Record the baseline balance on first read after PIX was generated
                setBalanceBeforePayment(prev => {
                    const baseline = prev !== null ? prev : currentBalance;

                    // ONLY confirm when balance INCREASES beyond the baseline (new payment received)
                    const depositedAmount = parseFloat(String(formData.depositedValue || '0').replace(',', '.'));
                    const expectedIncrease = isNaN(depositedAmount) ? 1 : depositedAmount;

                    if (currentBalance >= baseline + expectedIncrease * 0.9) {
                        setPaymentConfirmed(true);
                        // Clear storage once confirmed
                        localStorage.removeItem('signup_step');
                        localStorage.removeItem('signup_currentSubStep');
                        localStorage.removeItem('signup_generatedId');
                        localStorage.removeItem('signup_paymentData');
                        localStorage.removeItem('signup_formData');
                    }

                    return baseline; // Keep tracking the same baseline
                });
            }
        });

        return () => unsub();
    }, [currentUser?.uid, paymentData]);

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


    const generateUniqueCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const resetRegistration = () => {
        if (window.confirm("Tem certeza que deseja cancelar e iniciar um novo cadastro do zero?")) {
            setPaymentData(null);
            setCurrentSubStep(1);
            setGeneratedId('');
            setPaymentConfirmed(false);
            setFormData({
                name: currentUser?.displayName || '',
                email: currentUser?.email || '',
                phone: '',
                cpf: '',
                street: '',
                neighborhood: '',
                city: '',
                photoUrl: '',
                pixKey: '',
                depositedValue: ''
            });
            setError(null);
            setPhotoPreview(null);

            // Clear all localStorage signup states
            localStorage.removeItem('signup_step');
            localStorage.removeItem('signup_currentSubStep');
            localStorage.removeItem('signup_generatedId');
            localStorage.removeItem('signup_paymentData');
            localStorage.removeItem('signup_formData');
        }
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
            const url = await safeUploadFile(file, `profiles / external / ${Date.now()}_${file.name} `);
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

    const handleFieldBlur = async (field: 'email' | 'phone' | 'cpf', value: string) => {
        if (!value || value.trim().length < 5) return;
        
        setCheckingDuplicates(true);
        try {
            const errorMsg = await isFieldDuplicate(field, value, currentUser?.uid);
            setFieldErrors(prev => ({ ...prev, [field]: errorMsg || undefined }));
        } catch (err) {
            console.error(`Error checking duplicate for ${field}:`, err);
        } finally {
            setCheckingDuplicates(false);
        }
    };

    const nextStep = async () => {
        if (Object.values(fieldErrors).some(err => !!err)) {
            setError("CORRIJA OS CAMPOS DUPLICADOS ANTES DE PROSSEGUIR.");
            return;
        }

        setCheckingDuplicates(true);
        try {
            // Final check before moving
            if (currentSubStep === 1) {
                const emailErr = await isFieldDuplicate('email', formData.email, currentUser?.uid);
                const phoneErr = await isFieldDuplicate('phone', formData.phone, currentUser?.uid);
                const cpfErr = await isFieldDuplicate('cpf', formData.cpf, currentUser?.uid);
                
                if (emailErr || phoneErr || cpfErr) {
                    setFieldErrors({ email: emailErr || undefined, phone: phoneErr || undefined, cpf: cpfErr || undefined });
                    setError("DADOS DUPLICADOS ENCONTRADOS. VERIFIQUE OS CAMPOS.");
                    return;
                }
            }

            if (validateStep(currentSubStep)) {
                setCurrentSubStep(prev => prev + 1);
                window.scrollTo(0, 0);
            } else {
                alert("Por favor, preencha todos os campos obrigatórios da etapa atual.");
            }
        } catch (err: any) {
            setError("ERRO AO VALIDAR DADOS: " + err.message);
        } finally {
            setCheckingDuplicates(false);
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

        // Validate amount
        const rawAmount = String(formData.depositedValue || '');
        const numericAmount = parseFloat(rawAmount.replace(',', '.'));
        const minVal = systemSettings?.minDepositValue || 30;

        if (isNaN(numericAmount) || numericAmount < minVal) {
            alert(`O valor do depósito deve ser pelo menos R$ ${minVal.toFixed(2).replace('.', ',')}`);
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
                depositedValue: numericAmount,
                uniqueCode,
                status: 'analise' as any
            } as any, currentUser?.uid);

            setGeneratedId(uniqueCode);

            // 2. Gerar pagamento
            if (manualPixConfig?.enabled && manualPixConfig.pixKey) {
                // MANUAL PIX: gerar payload localmente, sem AbacatePay
                const payload = generatePixPayload(
                    manualPixConfig.pixKey,
                    manualPixConfig.recipientName || 'FAVORECIDO',
                    numericAmount
                );
                setManualPixPayload(payload);
                console.log('SIGNUP: PIX Manual gerado localmente');
            } else {
                // ABACATEPAY: gerar via cloud function
                try {
                    const pixName = (formData.name || currentUser?.displayName || '').trim();
                    const pixEmail = (formData.email || currentUser?.email || '').trim();

                    if (!pixName || !pixEmail) {
                        throw new Error("Nome e e-mail são obrigatórios para gerar o PIX. Volte e preencha seus dados.");
                    }

                    console.log("SIGNUP: Iniciando geração de PIX para", pixName);
                    const billing = await generateSignupPix({
                        name: pixName,
                        email: pixEmail,
                        phone: formData.phone || '',
                        cpf: formData.cpf || '',
                        amount: numericAmount
                    });
                    console.log("SIGNUP: PIX gerado com sucesso:", billing);
                    setPaymentData(billing);
                } catch (payError: any) {
                    console.error("SIGNUP: Erro ao gerar pagamento:", payError);
                    alert("Erro ao gerar PIX: " + (payError.message || "Verifique as configurações do AbacatePay no Admin."));
                    setLoading(false);
                    return;
                }
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
                                {currentSubStep > s ? <Check className="w-4 h-4" /> : s}
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
                                                        onBlur={() => handleFieldBlur('phone', formData.phone)}
                                                        onChange={e => {
                                                            const maskedValue = maskPhone(e.target.value);
                                                            setFormData({ ...formData, phone: maskedValue });
                                                            if (error) setError(null);
                                                            if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: undefined }));
                                                        }}
                                                    />
                                                </div>
                                                {fieldErrors.phone && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1 animate-pulse uppercase font-sport">{fieldErrors.phone}</p>}
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
                                                        onBlur={() => handleFieldBlur('cpf', formData.cpf)}
                                                        onChange={e => {
                                                            const maskedValue = maskCPF(e.target.value);
                                                            setFormData({ ...formData, cpf: maskedValue });
                                                            if (error) setError(null);
                                                            if (fieldErrors.cpf) setFieldErrors(prev => ({ ...prev, cpf: undefined }));
                                                        }}
                                                    />
                                                </div>
                                                {fieldErrors.cpf && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1 animate-pulse uppercase font-sport">{fieldErrors.cpf}</p>}
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
                                                    onBlur={() => handleFieldBlur('email', formData.email)}
                                                    onChange={e => {
                                                        setFormData({ ...formData, email: e.target.value });
                                                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                                                    }}
                                                />
                                            </div>
                                            {fieldErrors.email && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1 animate-pulse uppercase font-sport">{fieldErrors.email}</p>}
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
                                    {paymentConfirmed ? (
                                        <div className="space-y-6 text-center py-10 animate-in zoom-in-95 duration-500">
                                            <div className="flex justify-center">
                                                <div className="w-20 h-20 bg-lime-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.4)]">
                                                    <Check className="w-10 h-10 text-black stroke-[4px]" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <h2 className="text-2xl font-black italic font-sport uppercase text-lime-400">Inscrição Confirmada!</h2>
                                                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Parabéns Atleta! Seu acesso foi liberado.</p>
                                            </div>
                                            <div className="p-6 bg-zinc-800/50 border border-zinc-700 rounded-[2rem] space-y-4">
                                                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Seu ID de Atleta</p>
                                                <div className="text-4xl font-black italic font-sport tracking-tighter text-white">
                                                    {generatedId}
                                                </div>
                                                <button
                                                    onClick={() => navigate('/')}
                                                    className="w-full py-4 bg-lime-400 text-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.03] active:scale-95 transition-all"
                                                >
                                                    Ir para o Dashboard
                                                </button>
                                            </div>
                                        </div>
                                    ) : manualPixPayload ? (
                                        // MANUAL PIX FLOW
                                        depositPending ? (
                                            // Aguardando aprovação do admin
                                            <div className="space-y-6 text-center py-10 animate-in zoom-in-95 duration-500">
                                                <div className="flex justify-center">
                                                    <div className="w-20 h-20 bg-amber-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-pulse">
                                                        <Clock className="w-10 h-10 text-black" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-black italic font-sport uppercase text-amber-400">Aguardando Aprovação</h2>
                                                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Seu comprovante foi registrado!</p>
                                                </div>
                                                <div className="p-5 bg-zinc-800/60 border border-zinc-700 rounded-2xl text-left space-y-3">
                                                    <p className="text-zinc-400 text-xs leading-relaxed">
                                                        📋 Nossa equipe irá verificar o pagamento e liberar seu acesso em breve.
                                                    </p>
                                                    <p className="text-zinc-400 text-xs leading-relaxed">
                                                        ⏱️ Tempo médio de aprovação: até 15 minutos durante horário comercial.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            // QR Code local
                                            <div className="space-y-6">
                                                <div className="space-y-1 text-center">
                                                    <h2 className="text-xl font-black italic font-sport uppercase text-lime-400">Pagamento PIX</h2>
                                                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Escaneie o QR Code ou copie o código</p>
                                                    <p className="text-3xl font-black text-white">
                                                        R$ {parseFloat(String(formData.depositedValue || '0').replace(',', '.')).toFixed(2).replace('.', ',')}
                                                    </p>
                                                </div>

                                                <div className="bg-black border-2 border-zinc-800 p-6 rounded-[2rem] space-y-5">
                                                    <div className="flex justify-center">
                                                        <div className="bg-white p-4 rounded-2xl shadow-xl">
                                                            <QRCodeSVG value={manualPixPayload} size={180} level="M" />
                                                        </div>
                                                    </div>

                                                    {manualPixConfig?.recipientName && (
                                                        <p className="text-zinc-500 text-[10px] text-center uppercase tracking-widest">
                                                            Favorecido: <span className="text-white font-black">{manualPixConfig.recipientName}</span>
                                                        </p>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(manualPixPayload || '');
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }}
                                                        className="w-full py-4 bg-zinc-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-700 flex items-center justify-center gap-2 transition-all"
                                                    >
                                                        {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                                                        {copied ? 'Copiado!' : 'Copiar Código PIX'}
                                                    </button>

                                                    <button
                                                        onClick={async () => {
                                                            if (!currentUser?.uid) return;
                                                            const amount = parseFloat(String(formData.depositedValue || '0').replace(',', '.'));
                                                            try {
                                                                await createDepositRequest(
                                                                    currentUser.uid,
                                                                    formData.name || currentUser.displayName || 'Atleta',
                                                                    amount,
                                                                    manualPixConfig?.pixKey || '',
                                                                    formData.phone,
                                                                    'signup'
                                                                );
                                                                setDepositPending(true);
                                                            } catch (err: any) {
                                                                alert('Erro ao registrar: ' + err.message);
                                                            }
                                                        }}
                                                        className="w-full py-4 bg-lime-400 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        Já Paguei
                                                    </button>
                                                    <p className="text-zinc-600 text-[10px] text-center">
                                                        Ao clicar em "Já Paguei", sua solicitação será enviada para aprovação manual da equipe.
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={resetRegistration}
                                                    className="w-full py-3 border border-zinc-700 text-zinc-500 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:border-zinc-600 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    Fazer novo cadastro do zero
                                                </button>
                                            </div>
                                        )
                                    ) : paymentData ? (
                                        // PAGAMENTO INLINE (AbacatePay)
                                        <div className="space-y-6">
                                            <div className="space-y-2 text-center">
                                                <h2 className="text-xl font-black italic font-sport uppercase text-lime-400">Pagamento PIX</h2>
                                                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Aguardando seu depósito de R$ {parseFloat(String(formData.depositedValue || '0').replace(',', '.')).toFixed(2).replace('.', ',')}</p>
                                            </div>

                                            <div className="bg-black border-2 border-zinc-800 p-6 rounded-[2rem] space-y-6">
                                                {paymentData?.pix?.qrcode ? (
                                                    <div className="bg-white p-4 rounded-2xl mx-auto w-40 h-40 shadow-xl">
                                                        <img src={paymentData.pix.qrcode} alt="QR Code PIX" className="w-full h-full" />
                                                    </div>
                                                ) : paymentData?.url ? (
                                                    <div className="space-y-4">
                                                        <p className="text-zinc-500 text-xs text-center border p-4 border-zinc-700/50 rounded-xl bg-zinc-800/30">
                                                            Para realizar seu depósito, clique no botão abaixo e acesse a área segura do AbacatePay.
                                                        </p>
                                                        <a href={paymentData.url} target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-lime-400 text-black text-center font-black rounded-xl uppercase hover:scale-[1.03] active:scale-95 transition-all">
                                                            Pagar Pix no Navegador
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-zinc-600 italic text-xs text-center flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Gerando Pagamento...
                                                    </div>
                                                )}

                                                {paymentData?.pix?.payload && (
                                                    <div className="space-y-3">
                                                        <button
                                                            onClick={handleCopyPix}
                                                            className="w-full py-4 bg-zinc-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-700 flex items-center justify-center gap-2 transition-all"
                                                        >
                                                            {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                                                            {copied ? 'Copiado!' : 'Copiar código PIX'}
                                                        </button>
                                                        <p className="text-zinc-600 text-[10px] text-center w-full px-4">
                                                            Escaneie o QR Code ou copie a chave para realizar o depósito. O sistema identificará automaticamente.
                                                        </p>
                                                    </div>
                                                )}

                                                {paymentData?.url && paymentData?.pix?.qrcode && (
                                                    <div className="mt-4 border-t border-zinc-800 pt-4">
                                                        <button
                                                            onClick={() => window.open(paymentData.url, '_blank')}
                                                            className="w-full py-3 border border-lime-400/30 text-lime-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-lime-400/10 flex items-center justify-center gap-2 transition-all"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            Abrir no navegador
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 bg-lime-400/5 border border-lime-400/20 rounded-2xl">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase leading-relaxed text-center">
                                                    Escaneie o QR Code ou copie a chave para realizar o depósito. O sistema identificará automaticamente.
                                                </p>
                                            </div>

                                            <div className="mt-6 flex justify-center">
                                                <button
                                                    type="button"
                                                    onClick={resetRegistration}
                                                    className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors tracking-widest flex items-center gap-2"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> Fazer novo cadastro do zero
                                                </button>
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
                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block text-center">Valor do deposito (Mín. R$ {systemSettings?.minDepositValue || 30})</label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[
                                                            systemSettings?.minDepositValue || 30,
                                                            30,
                                                            40,
                                                            50
                                                        ].reduce((acc, val) => acc.includes(val) ? acc : [...acc, val], [] as number[]).sort((a, b) => a - b).map(value => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, depositedValue: String(value) })}
                                                                className={`py-3 rounded-xl font-black italic font-sport text-sm transition-all border-2 ${formData.depositedValue === String(value)
                                                                    ? 'bg-lime-400 text-black border-lime-400 scale-[1.05] shadow-[0_0_20px_rgba(163,230,53,0.2)]'
                                                                    : 'bg-black text-zinc-700 border-zinc-800'
                                                                    }`}
                                                            >
                                                                {value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                                                        <input
                                                            required
                                                            type="text"
                                                            inputMode="decimal"
                                                            placeholder="Outro valor..."
                                                            className="w-full pl-14 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all"
                                                            value={formData.depositedValue}
                                                            onChange={e => setFormData({ ...formData, depositedValue: e.target.value.replace(/[^0-9.,]/g, '') })}
                                                        />
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
                            {!paymentConfirmed && (
                                <div className="pt-4 flex gap-4">
                                    {currentSubStep > 1 && !paymentData && !depositPending && (
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
                                            disabled={checkingDuplicates}
                                            className="flex-[2] py-5 bg-lime-400 text-black rounded-2xl font-black uppercase tracking-widest text-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 italic font-sport border-b-4 border-lime-600 shadow-xl shadow-lime-900/10 disabled:opacity-50"
                                        >
                                            {checkingDuplicates ? 'Verificando...' : 'Avançar'} 
                                            <ArrowRight className={`w-6 h-6 ${checkingDuplicates ? 'animate-spin' : ''}`} />
                                        </button>
                                    ) : paymentData || depositPending ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/analise')}
                                            className="flex-1 py-6 bg-lime-400 text-black rounded-2xl font-black text-xl shadow-[0_20px_40px_rgba(163,230,53,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter italic font-sport border-b-4 border-lime-600"
                                        >
                                            <Check className="w-6 h-6" /> {depositPending ? 'Concluir' : 'Já Paguei'}
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
                            )}
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
