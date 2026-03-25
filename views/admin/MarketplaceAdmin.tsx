import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Plus, Pencil, Trash2, Eye, EyeOff,
  Package, Coins, Wallet, Lock, Save, X, CheckCircle2,
  AlertCircle, Loader2, ShoppingCart, Clock, User, Upload, ImageIcon
} from 'lucide-react';
import {
  subscribeToMarketplaceProducts,
  addMarketplaceProduct,
  updateMarketplaceProduct,
  deleteMarketplaceProduct,
  subscribeToUsers,
  subscribeToPartners
} from '../../services/db';
import { MarketplaceProduct, User as UserType, MarketplacePartner } from '../../types';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db as firestoreDb, storage } from '../../services/firebase';
import { MARKETPLACE_PURCHASES_COLLECTION } from '../../services/db';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface Purchase {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  coinsSpent: number;
  freeBalanceSpent: number;
  lockedBalanceSpent: number;
  purchasedAt: string;
}

const emptyForm: Omit<MarketplaceProduct, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  imageUrl: '',
  category: '',
  partnerId: '',
  costCoins: 0,
  costFreeBalance: 0,
  costLockedBalance: 0,
  stock: undefined,
  active: true,
};

const MarketplaceAdmin: React.FC = () => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [tab, setTab] = useState<'products' | 'purchases'>('products');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MarketplaceProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isNewCategory, setIsNewCategory] = useState(false);
  
  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  useEffect(() => {
    const unsub1 = subscribeToMarketplaceProducts(setProducts);
    const unsub2 = subscribeToUsers(setUsers);
    const unsub4 = subscribeToPartners(setPartners);

    const q = query(
      collection(firestoreDb, MARKETPLACE_PURCHASES_COLLECTION),
      orderBy('purchasedAt', 'desc')
    );
    const unsub3 = onSnapshot(q, snap => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const showAlert = (type: 'ok' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert('error', 'Selecione um arquivo de imagem.');
      return;
    }
    const storageRef = ref(storage, `marketplace/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { showAlert('error', err.message); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setForm(f => ({ ...f, imageUrl: url }));
        setUploadProgress(null);
      }
    );
  };

  const openNew = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setIsModalOpen(true);
    setIsNewCategory(false);
  };

  const openEdit = (p: MarketplaceProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      imageUrl: p.imageUrl ?? '',
      category: p.category ?? '',
      partnerId: p.partnerId ?? '',
      costCoins: p.costCoins ?? 0,
      costFreeBalance: p.costFreeBalance ?? 0,
      costLockedBalance: p.costLockedBalance ?? 0,
      stock: p.stock,
      active: p.active,
    });
    setIsModalOpen(true);
    setIsNewCategory(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showAlert('error', 'Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      // Build payload without any undefined values (Firestore rejects undefined)
      const base: Record<string, unknown> = {
        name: form.name.trim(),
        active: form.active,
        costCoins: Number(form.costCoins) || 0,
        costFreeBalance: Number(form.costFreeBalance) || 0,
        costLockedBalance: 0,
        createdAt: editingProduct?.createdAt ?? new Date().toISOString(),
      };

      if (form.description) base.description = form.description;
      if (form.imageUrl) base.imageUrl = form.imageUrl;
      if (form.category) base.category = form.category;
      if (form.partnerId) base.partnerId = form.partnerId;
      // Only include stock if it has a real numeric value
      if (form.stock !== undefined && form.stock !== null && String(form.stock) !== '') {
        base.stock = Number(form.stock);
      }

      if (editingProduct) {
        await updateMarketplaceProduct({ ...(base as any), id: editingProduct.id });
        showAlert('ok', 'Produto atualizado!');
      } else {
        await addMarketplaceProduct(base as any);
        showAlert('ok', 'Produto criado!');
      }
      setIsModalOpen(false);
    } catch (e: any) {
      showAlert('error', e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"?`)) return;
    setDeleting(id);
    try {
      await deleteMarketplaceProduct(id);
      showAlert('ok', 'Produto excluído.');
    } catch (e: any) {
      showAlert('error', e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (p: MarketplaceProduct) => {
    try {
      await updateMarketplaceProduct({ ...p, active: !p.active });
    } catch (e: any) {
      showAlert('error', e.message);
    }
  };

  const userName = (id: string) => users.find(u => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight font-sport">Marketplace</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
            {products.length} produtos · {purchases.length} compras realizadas
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-3 bg-black text-lime-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-lime-400 hover:text-black transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-[11px] font-bold ${
          alert.type === 'ok'
            ? 'bg-lime-50 border-lime-300 text-lime-700'
            : 'bg-rose-50 border-rose-300 text-rose-700'
        }`}>
          {alert.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {alert.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-slate-200">
        {(['products', 'purchases'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 -mb-[2px] ${
              tab === t
                ? 'border-lime-500 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {t === 'products' ? '📦 Produtos' : '🛒 Compras'}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <>
          {products.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum produto cadastrado</p>
              <button onClick={openNew} className="text-[10px] font-black text-lime-600 hover:underline uppercase tracking-widest">
                + Criar primeiro produto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(p => (
                <div key={p.id} className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm transition-all ${p.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  {/* Image */}
                  {p.imageUrl ? (
                    <div className="h-28 overflow-hidden bg-slate-100">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-16 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Package className="w-6 h-6 text-slate-300" />
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <div>
                      {p.category && (
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{p.category}</p>
                      )}
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{p.name}</h3>
                      {p.description && (
                        <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{p.description}</p>
                      )}
                    </div>

                    {/* Costs */}
                    <div className="flex flex-wrap gap-1.5">
                      {p.costCoins ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-[8px] font-black">
                          <Coins className="w-2.5 h-2.5" />{p.costCoins} moedas
                        </span>
                      ) : null}
                      {p.costFreeBalance ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-lime-50 border border-lime-200 text-lime-700 rounded-lg text-[8px] font-black">
                          <Wallet className="w-2.5 h-2.5" />R$ {p.costFreeBalance.toFixed(2)} livre
                        </span>
                      ) : null}
                      {p.costLockedBalance ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[8px] font-black">
                          <Lock className="w-2.5 h-2.5" />R$ {p.costLockedBalance.toFixed(2)} travado
                        </span>
                      ) : null}
                    </div>

                    {/* Stock */}
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                      Estoque: {p.stock !== undefined ? p.stock : 'Ilimitado'}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleToggleActive(p)}
                        title={p.active ? 'Desativar' : 'Ativar'}
                        className={`p-2 rounded-lg border transition-all ${p.active ? 'text-lime-600 border-lime-200 hover:bg-lime-50' : 'text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {p.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-2 text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={deleting === p.id}
                        className="p-2 text-rose-500 border border-rose-100 rounded-lg hover:bg-rose-50 transition-all ml-auto"
                      >
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PURCHASES TAB */}
      {tab === 'purchases' && (
        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhuma compra realizada ainda</p>
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y-2 divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Data', 'Atleta', 'Produto', 'Moedas', 'Livre', 'Travado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50">
                    {purchases.map(pur => (
                      <tr key={pur.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-[10px] text-slate-500 font-bold">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-300" />
                            {new Date(pur.purchasedAt).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-300" />
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{userName(pur.userId)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-black text-slate-700 uppercase tracking-tight">{pur.productName}</td>
                        <td className="px-4 py-3">
                          {pur.coinsSpent ? <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-[8px] font-black">{pur.coinsSpent} 🪙</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {pur.freeBalanceSpent ? <span className="px-2 py-0.5 bg-lime-50 border border-lime-200 text-lime-700 rounded-lg text-[8px] font-black">R$ {pur.freeBalanceSpent.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {pur.lockedBalanceSpent ? <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[8px] font-black">R$ {pur.lockedBalanceSpent.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y-2 divide-slate-100">
                {purchases.map(pur => (
                  <div key={pur.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{pur.productName}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{new Date(pur.purchasedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{userName(pur.userId)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pur.coinsSpent ? <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-[8px] font-black">{pur.coinsSpent} 🪙</span> : null}
                      {pur.freeBalanceSpent ? <span className="px-2 py-0.5 bg-lime-50 border border-lime-200 text-lime-700 rounded text-[8px] font-black">R$ {pur.freeBalanceSpent.toFixed(2)} livre</span> : null}
                      {pur.lockedBalanceSpent ? <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[8px] font-black">R$ {pur.lockedBalanceSpent.toFixed(2)} travado</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───── MODAL ───── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b-2 border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-lime-400" />
                </div>
                <h3 className="text-sm font-black italic text-slate-900 uppercase tracking-tight font-sport">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Camiseta Premium"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 focus:ring-2 focus:ring-lime-100 outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Detalhe o produto..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 focus:ring-2 focus:ring-lime-100 outline-none transition-all resize-none"
                />
              </div>

              {/* Category + Partner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Categoria</label>
                  {isNewCategory ? (
                    <div className="flex gap-2">
                       <input
                        type="text"
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        placeholder="Nome da categoria"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 outline-none transition-all"
                      />
                      <button type="button" onClick={() => { setIsNewCategory(false); setForm(f => ({ ...f, category: '' })) }} className="px-4 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.category || ''}
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          setIsNewCategory(true);
                          setForm(f => ({ ...f, category: '' }));
                        } else {
                          setForm(f => ({ ...f, category: e.target.value }));
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 outline-none transition-all"
                    >
                      <option value="">Selecione...</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__NEW__">+ Nova Categoria</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Loja Parceira</label>
                  <select
                    value={form.partnerId}
                    onChange={e => setForm(f => ({ ...f, partnerId: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 outline-none transition-all"
                  >
                    <option value="">(Plataforma / Sem parceiro)</option>
                    {partners.filter(p => p.active).map(partner => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Estoque</label>
                  <input
                    type="number"
                    min={0}
                    value={form.stock ?? ''}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    placeholder="∞ Ilimitado"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-lime-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Imagem do Produto</label>

                {/* Upload zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer group ${
                    uploadProgress !== null ? 'border-lime-300 bg-lime-50' : 'border-slate-200 hover:border-lime-400 hover:bg-lime-50/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageUpload(file);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />

                  {form.imageUrl && uploadProgress === null ? (
                    /* Preview */
                    <div className="relative">
                      <img src={form.imageUrl} alt="Preview" className="w-full h-36 object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <div className="flex items-center gap-1.5 text-white text-[9px] font-black uppercase tracking-widest">
                          <Upload className="w-3.5 h-3.5" />
                          Trocar imagem
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: '' })); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : uploadProgress !== null ? (
                    /* Progress */
                    <div className="p-6 flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-lime-500 animate-spin" />
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className="bg-lime-400 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-[9px] font-black text-lime-600 uppercase tracking-widest">{uploadProgress}% enviado</p>
                    </div>
                  ) : (
                    /* Empty state */
                    <div className="p-6 flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Clique ou arraste uma imagem</p>
                      <p className="text-[8px] font-bold">JPG, PNG, WEBP · Máx 5MB</p>
                    </div>
                  )}
                </div>

                {/* URL fallback */}
                <div className="mt-2">
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Ou cole uma URL de imagem..."
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:border-lime-400 outline-none transition-all"
                  />
                </div>
              </div>


              {/* Costs */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Custo do Produto</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-yellow-600 uppercase tracking-widest mb-1.5">🪙 Moedas</label>
                    <input
                      type="number"
                      min={0}
                      value={form.costCoins || ''}
                      onChange={e => setForm(f => ({ ...f, costCoins: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-sm font-black text-yellow-800 focus:border-yellow-400 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-lime-600 uppercase tracking-widest mb-1.5">💵 Dinheiro (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.costFreeBalance || ''}
                      onChange={e => setForm(f => ({ ...f, costFreeBalance: Number(e.target.value) }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-lime-50 border-2 border-lime-200 rounded-xl text-sm font-black text-lime-800 focus:border-lime-400 outline-none transition-all"
                    />
                  </div>
                </div>
                <p className="text-[8px] text-slate-400 font-bold mt-2">Deixe 0 nos campos que não deve ser cobrado</p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border-2 border-slate-100">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Produto Ativo</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-lime-400' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="p-6 border-t-2 border-slate-100 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-black text-lime-400 font-black text-[10px] uppercase tracking-widest hover:bg-lime-400 hover:text-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editingProduct ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceAdmin;
