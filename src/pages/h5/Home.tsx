import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Search, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Brand {
  id: string;
  name: string;
  logo: string;
  categoryId: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const brandSnap = await getDocs(collection(db, 'brands'));
        
        const catList = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        catList.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        
        setCategories(catList);
        setBrands(brandSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">
            卡券寄售
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">便捷寄售，闲置变现</p>
        </div>
        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-50 shadow-sm">
          <img src="https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff" alt="Avatar" />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="搜索品牌，如：星巴克"
          className="w-full rounded-2xl border-2 border-transparent bg-white px-12 py-4 text-sm font-medium shadow-xl shadow-slate-200 outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="mb-10 grid grid-cols-4 gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="flex animate-pulse flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-2xl bg-slate-200"></div>
              <div className="h-3 w-10 bg-slate-200"></div>
            </div>
          ))
        ) : (
          categories.map((cat) => (
            <button 
              key={cat.id} 
              onClick={() => navigate(`/categories?cid=${cat.id}`)}
              className="flex flex-col items-center gap-2 transition-transform active:scale-90"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-slate-200 text-2xl border border-slate-50">
                {cat.icon || '📦'}
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">{cat.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Popular Brands */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800">热门寄售</h2>
          <button className="text-xs font-black uppercase tracking-widest text-indigo-600">更多</button>
        </div>

        <div className="space-y-4">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-20 w-full animate-pulse rounded-3xl bg-slate-200"></div>
            ))
          ) : (
            filteredBrands.map((brand) => (
              <motion.div
                key={brand.id}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={`/brand/${brand.id}`}
                  className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-xl shadow-slate-200 hover:shadow-2xl transition-all border border-slate-50 group"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1 group-hover:bg-indigo-50 transition-colors border border-slate-100 overflow-hidden">
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-2xl font-black italic text-indigo-600">{brand.name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-slate-800">{brand.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">支持多种寄售方式</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ChevronRight size={18} />
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
