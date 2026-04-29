import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Layers, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', icon: '', order: 0 });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      setCategories(snap.docs.map(doc => ({ ...doc.data() } as Category)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'categories', formData.id), formData);
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      console.error(err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该类目吗？这将影响前端显示。')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 space-y-8 p-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">类目管理</h2>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">配置用户端的分类磁贴</p>
        </div>
        
        <button
          onClick={() => {
            setFormData({ id: '', name: '', icon: '', order: categories.length + 1 });
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          新增类目
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <div key={cat.id} className="group relative rounded-[2.5rem] bg-white p-6 border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:border-indigo-100 transition-all">
            <div className="flex items-start justify-between mb-6">
              <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                {cat.icon}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setFormData(cat);
                    setEditingCategory(cat);
                    setIsModalOpen(true);
                  }}
                  className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center active:scale-90"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <h3 className="text-lg font-black text-slate-800 tracking-tight">{cat.name}</h3>
            <div className="mt-2 flex items-center gap-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID: {cat.id}</span>
               <span className="h-1 w-1 rounded-full bg-slate-200" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">序号: {cat.order}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-[3rem] bg-white p-10 shadow-2xl border border-white/20">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {editingCategory ? '编辑类目' : '新增类目'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">类目 ID (不可修改)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCategory}
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="如: phone"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">显示名称</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如: 话费卡"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">图标 (Emoji)</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-lg text-center outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="📱"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">显示排序</label>
                  <input
                    type="number"
                    required
                    className="w-full rounded-2xl bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none border border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-[2rem] bg-indigo-600 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95"
              >
                保存配置记录
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
