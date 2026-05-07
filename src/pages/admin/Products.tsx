import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Settings2, Plus, Pencil, Trash2, X, Hash, Percent, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: string;
  brandId: string;
  faceValue: number;
  fastPrice?: number;
  slowPrice?: number;
  fastRate: number;
  slowRate: number;
  isActive: boolean;
  createdAt: string;
}

interface Brand {
  id: string;
  name: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    id: '',
    brandId: '',
    faceValue: 100,
    fastPrice: 94,
    slowPrice: 96,
    fastRate: 0.94,
    slowRate: 0.96,
    isActive: true,
    createdAt: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'configs'), orderBy('createdAt', 'desc'));
    const unsubProducts = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const fetchBrands = async () => {
      const snap = await getDocs(collection(db, 'brands'));
      const brandList = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setBrands(brandList);
      if (brandList.length > 0 && !formData.brandId) {
        setFormData(prev => ({ ...prev, brandId: brandList[0].id }));
      }
    };

    fetchBrands();
    return () => unsubProducts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandId || !formData.faceValue) return;

    // Auto-generate ID if name is not set (e.g. brandId-value)
    const productId = formData.id || `${formData.brandId}_${formData.faceValue}`;
    
    // Calculate rates for reference
    const fastPrice = Number(formData.fastPrice || 0);
    const slowPrice = Number(formData.slowPrice || 0);
    const faceValue = Number(formData.faceValue);
    const fastRate = faceValue > 0 ? fastPrice / faceValue : 0;
    const slowRate = faceValue > 0 ? slowPrice / faceValue : 0;

    try {
      await setDoc(doc(db, 'configs', productId), {
        ...formData,
        id: productId,
        faceValue,
        fastPrice,
        slowPrice,
        fastRate,
        slowRate,
        createdAt: formData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定移除该规格商品吗？')) return;
    try {
      await deleteDoc(doc(db, 'configs', id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      await setDoc(doc(db, 'configs', product.id), { ...product, isActive: !product.isActive });
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        id: '',
        brandId: brands[0]?.id || '',
        faceValue: 100,
        fastPrice: 94,
        slowPrice: 96,
        fastRate: 0.94,
        slowRate: 0.96,
        isActive: true,
        createdAt: ''
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 p-12 bg-[#F8F9FC] min-h-screen">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">商品管理</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">面值规格与多档结算率配置</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-indigo-100 hover:scale-105 transition-all active:scale-95"
        >
          <Plus size={18} />
          新增结算单品
        </button>
      </div>

      <div className="rounded-[3rem] bg-white shadow-2xl shadow-slate-200/40 border border-slate-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">序号</th>
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">品牌属性 / 面值</th>
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">极速折扣 (结算价)</th>
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">普通折扣 (结算价)</th>
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">创建时间</th>
                <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((cfg, index) => {
                const brand = brands.find(b => b.id === cfg.brandId);
                return (
                  <tr key={cfg.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-8 py-8 text-[10px] font-black text-slate-400">
                      {(index + 1).toString().padStart(2, '0')}
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm group-hover:bg-white group-hover:scale-110 transition-all">
                           <Hash size={24} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{brand?.name || cfg.brandId}</div>
                          <div className="text-2xl font-black text-slate-800 tracking-tighter">¥{cfg.faceValue}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-indigo-600 tracking-tighter">¥{cfg.fastPrice || (cfg.faceValue * cfg.fastRate).toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-400">费率: {((cfg.fastPrice / cfg.faceValue || cfg.fastRate) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-emerald-600 tracking-tighter">¥{cfg.slowPrice || (cfg.faceValue * cfg.slowRate).toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-400">费率: {((cfg.slowPrice / cfg.faceValue || cfg.slowRate) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {cfg.createdAt ? new Date(cfg.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <div className="flex justify-end gap-3 transition-all">
                          <button
                            onClick={() => toggleActive(cfg)}
                            title={cfg.isActive ? '下架' : '上架'}
                            className={cn(
                              "h-12 px-4 flex items-center justify-center gap-2 rounded-2xl transition-all shadow-sm active:scale-95 text-[10px] font-black uppercase tracking-widest",
                              cfg.isActive 
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                : "bg-slate-50 text-slate-400 border border-slate-100"
                            )}
                          >
                            <div className={cn("h-1.5 w-1.5 rounded-full", cfg.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                            {cfg.isActive ? '下架' : '上架'}
                          </button>
                          <button 
                            onClick={() => openModal(cfg)}
                            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm active:scale-90"
                            title="编辑"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            onClick={() => handleDelete(cfg.id)}
                            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 shadow-sm active:scale-90"
                            title="删除"
                          >
                            <Trash2 size={20} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && (
            <div className="py-32 flex flex-col items-center justify-center gap-4">
               <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-50 border-t-indigo-600" />
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">载入商品矩阵</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xl rounded-[3rem] bg-white p-12 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 h-32 w-32 bg-indigo-50/50 rounded-br-[5rem] -z-10" />
              
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {editingProduct ? '调整商品费率' : '新增结算单品'}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">控制特定面值的结算权益与折扣</p>
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
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">关联品牌</label>
                    <select
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 appearance-none"
                      value={formData.brandId}
                      onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                    >
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">关联基础商品 (仅显示)</label>
                    <select
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 appearance-none"
                      defaultValue=""
                    >
                      <option value="">未选择基准商品</option>
                      <option value="1">Starbucks Drink Voucher 100</option>
                      <option value="2">KFC Family Meal Card</option>
                      <option value="3">McDonald's Universal Coupon</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">商品面值 (¥)</label>
                    <input
                      type="number"
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600"
                      value={formData.faceValue}
                      onChange={(e) => setFormData({ ...formData, faceValue: Number(e.target.value) })}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-indigo-600 px-1 flex items-center gap-1">
                      <Percent size={12} /> 极速结算回款价 (¥)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600"
                      value={formData.fastPrice}
                      onChange={(e) => setFormData({ ...formData, fastPrice: Number(e.target.value) })}
                    />
                    <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      预估费率: {((Number(formData.fastPrice || 0) / Number(formData.faceValue || 1)) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-emerald-600 px-1 flex items-center gap-1">
                      <Percent size={12} /> 普通结算回款价 (¥)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-emerald-600"
                      value={formData.slowPrice}
                      onChange={(e) => setFormData({ ...formData, slowPrice: Number(e.target.value) })}
                    />
                     <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      预估费率: {((Number(formData.slowPrice || 0) / Number(formData.faceValue || 1)) * 100).toFixed(1)}%
                     </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-[2.5rem] bg-indigo-600 py-6 text-[11px] font-black uppercase tracking-[0.4em] text-white shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95"
                >
                  确立商品结算规则
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

