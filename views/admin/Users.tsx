import React, { useState, useEffect } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle, Search, X, Camera, Upload, Link as LinkIcon, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { subscribeToUsers, addUser, updateUser, deleteUser } from '../../services/db';
import { auth } from '../../services/firebase';
import { safeUploadFile } from '../../services/firebaseGuard';
import { User, UserStatus } from '../../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  // ... (existing code)

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    uniqueCode: '',
    phone: '',
    depositedValue: 0,
    pixKey: '',
    street: '',
    neighborhood: '',
    city: '',
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

  useEffect(() => {
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulating progress since safeUploadFile is a Promise
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const downloadURL = await safeUploadFile(file);

      clearInterval(interval);
      setUploadProgress(100);
      setFormData(prev => ({ ...prev, photoUrl: downloadURL }));

      setTimeout(() => setUploading(false), 500);

    } catch (error: any) {
      console.error("Error uploading:", error);
      setUploading(false);
      setUploadProgress(0);
      alert(`Erro no Upload: ${error.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Current User:", auth.currentUser); // Debug auth
    console.log("Form Data:", formData);
    try {
      if (editingUser) {
        await updateUser({ ...editingUser, ...formData });
      } else {
        await addUser(formData);
      }
      setFormData({
        name: '',
        cpf: '',
        uniqueCode: '',
        phone: '',
        depositedValue: 0,
        pixKey: '',
        street: '',
        neighborhood: '',
        city: '',
        photoUrl: ''
      });
      setEditingUser(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving user:", error);
      alert(`Erro ao salvar usuário: ${error.message}`);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      cpf: user.cpf,
      uniqueCode: user.uniqueCode,
      phone: user.phone,
      depositedValue: user.depositedValue,
      pixKey: user.pixKey || '',
      street: user.street || '',
      neighborhood: user.neighborhood || '',
      city: user.city || '',
      photoUrl: user.photoUrl || ''
    });
    setIsModalOpen(true);
  };

  const toggleStatus = async (user: User) => {
    try {
      let newStatus: UserStatus;
      if (user.status === UserStatus.PENDING) {
        newStatus = UserStatus.ACTIVE;
      } else if (user.status === UserStatus.ACTIVE) {
        newStatus = UserStatus.ELIMINATED;
      } else {
        newStatus = UserStatus.ACTIVE;
      }
      await updateUser({ ...user, status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (user: User) => {
    if (window.confirm(`TEM CERTEZA QUE DESEJA APAGAR O ATLETA ${user.name.toUpperCase()}? ESTA AÇÃO NÃO PODE SER DESFEITA.`)) {
      try {
        await deleteUser(user.id);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Erro ao apagar atleta.");
      }
    }
  };

  const copyToClipboard = async (text: string, type: 'pix' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pix') {
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 2000);
      } else {
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm) ||
    u.uniqueCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search and Action Bar - Bordas mais escuras */}
      {/* Search and Action Bar - Bordas mais escuras */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-[350px] group text-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-lime-600 transition-colors w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="PESQUISAR ATLETA..."
            className="w-full pl-10 pr-5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-md uppercase tracking-widest text-[10px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center px-4 py-2.5 bg-white text-slate-600 border-2 border-slate-200 rounded-xl font-black uppercase italic tracking-tighter hover:bg-slate-50 hover:border-slate-300 transition-all shadow-md active:scale-95 text-[10px]"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Externo
          </button>
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({
                name: '',
                cpf: '',
                uniqueCode: generateUniqueCode(),
                phone: '',
                depositedValue: 0,
                pixKey: '',
                street: '',
                neighborhood: '',
                city: '',
                photoUrl: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center px-4 py-2.5 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.05] transition-all shadow-2xl active:scale-95 text-[10px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Atleta
          </button>
        </div>
      </div>

      {/* Athletes List - Bordas e Sombras Reforçadas */}
      <div className="bg-white rounded-[1.25rem] border-2 border-slate-300 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
        <table className="min-w-full divide-y-2 divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Perfil do Atleta</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Identificação</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Métricas Financeiras</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-lime-600 font-black text-base border-2 border-slate-200 shadow-sm overflow-hidden">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{user.name && user.name[0] ? user.name[0].toUpperCase() : '?'}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{user.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{user.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF: {user.cpf}</div>
                  <div className="text-sm text-black font-black font-sport bg-lime-400 inline-block px-3 py-1 rounded-lg border-2 border-lime-500 uppercase tracking-widest italic shadow-sm transform group-hover:scale-105 transition-transform">
                    {user.uniqueCode}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Contribuição: R$ {user.depositedValue?.toFixed(2)}</div>
                  <div className="text-sm font-black text-slate-900 italic font-sport">R$ {user.balance?.toFixed(2)}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 inline-flex text-[9px] font-black rounded-full uppercase tracking-widest italic border shadow-sm ${user.status === UserStatus.ACTIVE
                    ? 'bg-lime-400 text-black border-lime-500'
                    : user.status === UserStatus.PENDING
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                    {user.status === UserStatus.ACTIVE ? 'Em Competição' : user.status === UserStatus.PENDING ? 'Em Análise' : 'Eliminado'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(user)} className="p-1.5 bg-white text-slate-400 hover:text-black hover:border-black rounded-md transition-all border border-slate-200 shadow-sm">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleStatus(user)}
                      className={`p-1.5 rounded-md transition-all border shadow-sm ${user.status === UserStatus.ACTIVE
                        ? 'bg-white text-slate-400 hover:text-rose-600 hover:border-rose-400 border-slate-200'
                        : user.status === UserStatus.PENDING
                          ? 'bg-white text-slate-400 hover:text-lime-600 hover:border-lime-400 border-slate-200'
                          : 'bg-white text-slate-400 hover:text-lime-600 hover:border-lime-400 border-slate-200'
                        }`}
                      title={user.status === UserStatus.PENDING ? "Aprovar Atleta" : user.status === UserStatus.ACTIVE ? "Eliminar Atleta" : "Reativar Atleta"}
                    >
                      {user.status === UserStatus.ACTIVE ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 bg-white text-slate-400 hover:text-red-600 hover:border-red-400 rounded-md transition-all border border-slate-200 shadow-sm"
                      title="Apagar Atleta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="p-16 text-center text-slate-400 font-black uppercase tracking-[0.3em] italic bg-slate-50 text-xs">Nenhum Atleta Identificado</div>
        )}
      </div>

      {/* Modal - Otimizado para telas menores */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[1.5rem] border-4 border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b-4 border-slate-100 shrink-0">
              <h3 className="text-xl font-black italic uppercase font-sport text-slate-900 tracking-widest">
                {editingUser ? 'Modificar Perfil' : 'Novo Recruta'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 bg-white rounded-lg border-2 border-slate-200 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {/* Foto Upload */}
                <div className="flex flex-col items-center justify-center gap-2 mb-1">
                  <div className="w-20 h-20 bg-slate-100 rounded-full border-4 border-slate-200 flex items-center justify-center overflow-hidden relative group">
                    {formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400" />
                    )}

                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col">
                        <span className="text-white text-[10px] font-bold">{Math.round(uploadProgress)}%</span>
                        <div className="w-12 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-lime-400 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                      <Upload className="w-6 h-6 text-white" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {uploading ? (
                    <p className="text-[10px] font-bold text-slate-400 animate-pulse uppercase">Enviando...</p>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Alterar Foto</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase placeholder:text-slate-300 text-xs"
                      placeholder="DIGITE O NOME"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CPF Registro</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                        value={formData.cpf}
                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tag Única (ID)</label>
                      <div className="relative group/id">
                        <input
                          readOnly
                          type="text"
                          className="w-full pl-4 pr-10 py-3 bg-lime-50/50 border-2 border-lime-200 rounded-xl text-lime-600 font-black font-sport italic transition-all outline-none uppercase cursor-not-allowed text-xs"
                          value={formData.uniqueCode}
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.uniqueCode, 'id')}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${idCopied ? 'bg-lime-400 text-black shadow-sm' : 'text-slate-400 hover:text-lime-600 hover:bg-lime-50'
                            }`}
                        >
                          {idCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefone</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Contribuição (R$)</label>
                      <input
                        required
                        type="number"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-black text-lg focus:ring-2 focus:ring-lime-400 transition-all outline-none"
                        value={formData.depositedValue}
                        onChange={e => setFormData({ ...formData, depositedValue: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pix</label>
                      <div className="relative group/pix">
                        <input
                          type="text"
                          className="w-full pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                          placeholder="CHAVE"
                          value={formData.pixKey}
                          onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.pixKey, 'pix')}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${pixCopied ? 'bg-lime-400 text-black shadow-sm' : 'text-slate-400 hover:text-lime-600 hover:bg-lime-50'
                            }`}
                        >
                          {pixCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Endereço (Rua)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                      value={formData.street}
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Bairro</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                        value={formData.neighborhood}
                        onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Cidade</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-4 bg-slate-50 border-t-4 border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-slate-400 font-black uppercase tracking-widest hover:text-slate-900 transition-colors text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter shadow-xl hover:scale-[1.05] transition-all text-[10px]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Link Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black italic uppercase font-sport text-slate-900">Link de Inscrição</h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-slate-100 p-6 rounded-2xl border-2 border-slate-200 break-all text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL Púbica</p>
                <code className="text-xs font-bold text-slate-600">
                  {window.location.origin}/#/inscrever
                </code>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/#/inscrever`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:scale-[1.02] transition-all"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
                <a
                  href={`${window.location.origin}/#/inscrever`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all border-2 border-slate-200"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed">
                Envie este link para que os atletas possam se cadastrar diretamente no sistema.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
