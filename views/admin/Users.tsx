import React, { useState, useEffect } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle, Search, X } from 'lucide-react';
import { subscribeToUsers, addUser, updateUser } from '../../services/db';
import { User, UserStatus } from '../../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    uniqueCode: '',
    phone: '',
    depositedValue: 0
  });

  useEffect(() => {
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser({ ...editingUser, ...formData });
      } else {
        await addUser(formData);
      }
      setFormData({ name: '', cpf: '', uniqueCode: '', phone: '', depositedValue: 0 });
      setEditingUser(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Erro ao salvar usuário.");
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      cpf: user.cpf,
      uniqueCode: user.uniqueCode,
      phone: user.phone,
      depositedValue: user.depositedValue
    });
    setIsModalOpen(true);
  };

  const toggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.ELIMINATED : UserStatus.ACTIVE;
      await updateUser({ ...user, status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative w-full md:w-[400px] group text-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-lime-600 transition-colors w-4 h-4" />
          <input
            type="text"
            placeholder="PESQUISAR ATLETA..."
            className="w-full pl-12 pr-6 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-md uppercase tracking-widest text-[11px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
          className="flex items-center px-6 py-3 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.05] transition-all shadow-2xl active:scale-95 text-xs"
        >
          <Plus className="w-5 h-5 mr-2" />
          Cadastrar Atleta
        </button>
      </div>

      {/* Athletes List - Bordas e Sombras Reforçadas */}
      <div className="bg-white rounded-[1.5rem] border-2 border-slate-300 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.06)]">
        <table className="min-w-full divide-y-2 divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Perfil do Atleta</th>
              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Identificação</th>
              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Métricas Financeiras</th>
              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Status</th>
              <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-lime-400 font-black text-lg border-2 border-zinc-800 shadow-md">
                      {user.name && user.name[0] ? user.name[0].toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{user.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{user.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF: {user.cpf}</div>
                  <div className="text-[10px] text-black font-black font-sport bg-lime-400 inline-block px-2.5 py-0.5 rounded-lg border-2 border-lime-500 uppercase tracking-tighter italic shadow-sm">
                    {user.uniqueCode}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Aposta: R$ {user.depositedValue?.toFixed(2)}</div>
                  <div className="text-base font-black text-slate-900 italic font-sport">R$ {user.balance?.toFixed(2)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-[8px] font-black rounded-full uppercase tracking-[0.2em] italic border-2 shadow-sm ${user.status === UserStatus.ACTIVE
                    ? 'bg-lime-400 text-black border-lime-500'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                    {user.status === UserStatus.ACTIVE ? 'Em Competição' : 'Eliminado'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(user)} className="p-2 bg-white text-slate-400 hover:text-black hover:border-black rounded-lg transition-all border-2 border-slate-200 shadow-sm">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleStatus(user)}
                      className={`p-2 rounded-lg transition-all border-2 shadow-sm ${user.status === UserStatus.ACTIVE
                        ? 'bg-white text-slate-400 hover:text-rose-600 hover:border-rose-400 border-slate-200'
                        : 'bg-white text-slate-400 hover:text-lime-600 hover:border-lime-400 border-slate-200'
                        }`}
                    >
                      {user.status === UserStatus.ACTIVE ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="p-20 text-center text-slate-400 font-black uppercase tracking-[0.3em] italic bg-slate-50">Nenhum Atleta Identificado</div>
        )}
      </div>

      {/* Modal - Bordas mais fortes para destacar da página clara */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-50 flex justify-between items-center border-b-4 border-slate-100">
              <h3 className="text-xl font-black italic uppercase font-sport text-slate-900 tracking-widest">
                {editingUser ? 'Modificar Perfil' : 'Novo Recruta'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 bg-white rounded-lg border-2 border-slate-200 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input
                    required
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase placeholder:text-slate-300"
                    placeholder="DIGITE O NOME"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">CPF Registro</label>
                    <input
                      required
                      type="text"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none"
                      value={formData.cpf}
                      onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tag Única (ID)</label>
                    <input
                      required
                      type="text"
                      className="w-full px-5 py-4 bg-lime-50 border-2 border-lime-200 rounded-2xl text-lime-600 font-black font-sport italic transition-all outline-none uppercase"
                      value={formData.uniqueCode}
                      onChange={e => setFormData({ ...formData, uniqueCode: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Telefone</label>
                  <input
                    required
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Aposta Inicial (R$)</label>
                  <input
                    required
                    type="number"
                    className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-black text-lg focus:ring-2 focus:ring-lime-400 transition-all outline-none"
                    value={formData.depositedValue}
                    onChange={e => setFormData({ ...formData, depositedValue: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
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
    </div>
  );
};

export default Users;
