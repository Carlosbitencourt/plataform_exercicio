import React, { useState, useRef } from 'react';
import { UserPlus, CheckCircle2, ArrowRight, ArrowLeft, Instagram, Phone, MapPin, Mail, CreditCard, User as UserIcon, Camera, Upload, Activity, Loader2, Copy, Check } from 'lucide-react';
import { addUser } from '../../services/db';
import { safeUploadFile } from '../../services/firebaseGuard';

const ExternalSignup: React.FC = () => {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [currentSubStep, setCurrentSubStep] = useState(1);
    const [generatedId, setGeneratedId] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            return formData.name && formData.phone && formData.email && formData.cpf;
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

        setLoading(true);

        try {
            const uniqueCode = generateUniqueCode();
            await addUser({
                ...formData,
                uniqueCode,
                status: 'analise' as any
            } as any);

            setGeneratedId(uniqueCode);
            setStep('success');
        } catch (error: any) {
            console.error("Error signing up:", error);
            alert("Erro ao realizar cadastro: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-lime-500/5 blur-[150px] rounded-full"></div>

                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-12 text-center space-y-8 relative z-10 shadow-2xl">
                    <div className="mx-auto w-24 h-24 bg-lime-400 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(163,230,53,0.3)] animate-bounce-slow">
                        <CheckCircle2 className="w-12 h-12 text-black" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-black italic uppercase font-sport tracking-tighter">Cadastro Realizado!</h2>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Bem-vindo(a) ao Impulso Club</p>
                    </div>

                    <div className="bg-black border-2 border-zinc-800 p-8 rounded-[2rem] space-y-4">
                        <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Seu ID Único de Atleta</p>
                        <div className="text-6xl font-black italic font-sport text-lime-400 tracking-widest">
                            {generatedId}
                        </div>

                        <button
                            onClick={copyId}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all ${copied
                                ? 'bg-lime-400 text-black shadow-[0_10px_20px_rgba(163,230,53,0.3)]'
                                : 'bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95'
                                }`}
                        >
                            {copied ? (
                                <><Check className="w-4 h-4" /> COPIADO!</>
                            ) : (
                                <><Copy className="w-4 h-4" /> COPIAR CÓDIGO</>
                            )}
                        </button>

                        <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest leading-relaxed mt-4">
                            Guarde este código! Você precisará dele para seus check-ins diários.
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.href = '#/checkin'}
                        className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.03] transition-all flex items-center justify-center gap-2"
                    >
                        IR PARA O CHECK-IN <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

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
                                                        className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none text-base"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
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
                                                        className="w-full pl-12 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold placeholder:text-zinc-800 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none text-base"
                                                        value={formData.cpf}
                                                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
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

                            {/* STEP 3: INVESTIMENTO E PERFIL */}
                            {currentSubStep === 3 && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
                                </div>
                            )}

                            {/* Navigation Buttons */}
                            <div className="pt-4 flex gap-4">
                                {currentSubStep > 1 && (
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
