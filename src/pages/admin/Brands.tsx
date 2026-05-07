import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Pencil, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Brand {
  id: string;
  name: string;
  logo: string;
  categoryId: string;
  supportTypes: string[];
  settlementCycle: string; // e.g., T+0, T+1, Instant
}

interface Category {
  id: string;
  name: string;
}

export default function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<Partial<Brand>>({
    id: '',
    name: '',
    logo: '',
    categoryId: 'sc',
    supportTypes: ['card_password'],
    settlementCycle: 'T+1'
  });

  useEffect(() => {
    const unsubBrands = onSnapshot(collection(db, 'brands'), (snap) => {
      setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand)));
      setLoading(false);
    });

    const fetchCategories = async () => {
      const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
      setCategories(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    };

    fetchCategories();
    return () => unsubBrands();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name) return;
    try {
      await setDoc(doc(db, 'brands', formData.id), formData);
      setIsModalOpen(false);
      setEditingBrand(null);
    } catch (err) {
      console.error(err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该品牌及所有相关设置吗？')) return;
    try {
      await deleteDoc(doc(db, 'brands', id));
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setFormData(brand);
    } else {
      setEditingBrand(null);
      setFormData({
        id: '',
        name: '',
        logo: '',
        categoryId: categories[0]?.id || 'sc',
        supportTypes: ['card_password'],
        settlementCycle: 'T+1'
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 p-12 bg-[#F8F9FC] min-h-screen">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">品牌管理</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">运营与结算周期深度配置</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-indigo-100 hover:scale-105 transition-all active:scale-95"
        >
          <Plus size={18} />
          添加合作新品牌
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {brands.map(brand => (
          <motion.div 
            layout
            key={brand.id} 
            className="group relative overflow-hidden rounded-[3rem] bg-white p-8 shadow-2xl shadow-slate-200/40 border border-slate-50 transition-all hover:shadow-indigo-100/50"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="h-20 w-20 rounded-3xl bg-slate-50 p-3 border border-slate-100 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <img src={brand.logo} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openModal(brand)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(brand.id)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{brand.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">ID: {brand.id}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    周期: {brand.settlementCycle || 'T+1'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {brand.supportTypes.map(t => (
                  <span key={t} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                    {t === 'card_password' ? '卡密' : '核销二维码'}
                  </span>
                ))}
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400">
                所属分类: <span className="text-slate-800 uppercase tracking-widest">{categories.find(c => c.id === brand.categoryId)?.name || brand.categoryId}</span>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4">
             <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-indigo-600" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">载入品牌矩阵</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-[3rem] bg-white p-12 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-50/50 rounded-bl-[5rem] -z-10" />
              
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {editingBrand ? '深度编辑品牌' : '整合新合作'}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {editingBrand ? '修改品牌属性与结算规则' : '定义品牌入口及交易模式'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all shadow-sm"
                >
                  <X size={28} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">品牌 ID (唯一标识)</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingBrand}
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="如: starbucks"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">显示名称</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="如: 星巴克"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">业务分类</label>
                    <select
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 appearance-none"
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">结算周期 (手动输入时长, 如: 10分钟/2小时)</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 shadow-sm"
                      value={formData.settlementCycle}
                      onChange={(e) => setFormData({ ...formData, settlementCycle: e.target.value })}
                      placeholder="例如: 2小时 / 24小时 / 极速"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Logo URL 地址</label>
                  <div className="flex gap-4">
                    <div className="flex-1 relative">
                       <ImageIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                       <input
                        type="url"
                        required
                        className="w-full rounded-2xl bg-slate-50 pl-14 pr-6 py-4 text-xs font-medium text-slate-600 outline-none border border-slate-100 focus:border-indigo-600"
                        value={formData.logo}
                        onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    {formData.logo && (
                      <div className="h-14 w-14 rounded-xl bg-slate-50 p-2 border border-slate-100 overflow-hidden">
                        <img src={formData.logo} alt="" className="h-full w-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">支持提交模式 (多选)</label>
                  <div className="flex gap-4">
                    {[
                      { id: 'card_password', label: '实体卡密录入' },
                      { id: 'qrcode', label: '核销二维码' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          const current = formData.supportTypes || [];
                          const updated = current.includes(type.id) 
                            ? current.filter(id => id !== type.id)
                            : [...current, type.id];
                          setFormData({ ...formData, supportTypes: updated });
                        }}
                        className={cn(
                          "flex-1 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest border transition-all",
                          formData.supportTypes?.includes(type.id)
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100"
                            : "bg-white text-slate-400 border-slate-100"
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-[2.5rem] bg-indigo-600 py-6 text-[11px] font-black uppercase tracking-[0.4em] text-white shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95"
                >
                  确立品牌配置资产
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

