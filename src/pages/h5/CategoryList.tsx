import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ChevronLeft, Search, Headphones } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface Category {
  id: string;
  name: string;
  icon?: string;
  order?: number;
}

interface Brand {
  id: string;
  name: string;
  logo: string;
  categoryId: string;
  highestRate?: number;
}

export default function CategoryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategoryId = searchParams.get('cid');

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(initialCategoryId);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const brandSnap = await getDocs(collection(db, 'brands'));
        
        const catList = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        catList.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        setCategories(catList);
        setBrands(brandSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));

        if (!initialCategoryId && catList.length > 0) {
          setActiveCategoryId(catList[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialCategoryId]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const categoryBrands = brands.filter(b => b.categoryId === activeCategoryId);
  
  const filteredBrands = categoryBrands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-[#F7F8FA]">
      {/* Custom Header */}
      <header className="flex h-12 items-center justify-between bg-white px-4">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft size={24} className="text-slate-800" />
        </button>
        <div className="flex items-center gap-2">
            <span className="text-xl font-black italic text-indigo-600 tracking-tighter">回收宝</span>
            <h1 className="text-lg font-bold text-slate-800">寄售列表</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50/50 px-3">
             <div className="h-1 w-1 rounded-full bg-slate-400" />
             <div className="h-1 w-1 rounded-full bg-slate-400" />
             <div className="h-1 w-1 rounded-full bg-slate-400" />
             <div className="mx-1 h-3 w-[1px] bg-slate-200" />
             <div className="h-4 w-4 rounded-full border-2 border-slate-800" />
          </div>
        </div>
      </header>

      {/* Search Bar Area */}
      <div className="flex items-center gap-4 bg-white px-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="请输入想出售的商品"
            className="w-full rounded-full bg-slate-100 py-2.5 pl-10 pr-4 text-xs font-medium outline-none placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-24 overflow-y-auto bg-[#F7F8FA] no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategoryId(cat.id);
                setSearchParams({ cid: cat.id });
              }}
              className={cn(
                "relative flex h-14 w-full items-center justify-center text-xs font-bold transition-all",
                activeCategoryId === cat.id 
                  ? "bg-white text-indigo-600" 
                  : "text-slate-600"
              )}
            >
              {activeCategoryId === cat.id && (
                <div className="absolute left-0 h-8 w-1.5 rounded-r-full bg-indigo-600" />
              )}
              {cat.name}
            </button>
          ))}
        </aside>

        {/* Right Content */}
        <main className="flex-1 overflow-y-auto bg-white p-4 no-scrollbar">
          <div className="mb-6">
            <h2 className="mb-6 text-sm font-bold text-slate-800">{activeCategory?.name}寄售</h2>
            
            <div className="grid grid-cols-2 gap-y-8">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-slate-100" />
                    <div className="h-3 w-16 bg-slate-100" />
                    <div className="h-2 w-10 bg-slate-100" />
                  </div>
                ))
              ) : filteredBrands.length > 0 ? (
                filteredBrands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => navigate(`/brand/${brand.id}`)}
                    className="flex flex-col items-center text-center group"
                  >
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm border border-slate-50 transition-transform group-active:scale-95">
                      {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xl font-black text-indigo-600">{brand.name[0]}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 px-1">{brand.name}</span>
                    <span className="mt-1 text-[10px] font-bold text-rose-500">
                      {brand.highestRate ? `${(brand.highestRate * 100).toFixed(0)}折` : '最高价'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="col-span-2 py-10 text-center">
                   <p className="text-xs font-medium text-slate-400">暂无相关品牌</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Mock secondary section if it exists in the screenshot's logic but not really here */}
          {/* In the screenshot it shows categories again below sometimes, but here we just show the active one */}
        </main>
      </div>
    </div>
  );
}
