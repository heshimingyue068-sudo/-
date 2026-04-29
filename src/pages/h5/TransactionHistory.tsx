import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { ChevronLeft, ChevronDown, Utensils, CreditCard, Search, Wallet, Smartphone, Gift, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface Transaction {
  id: string;
  type: 'income' | 'expenditure';
  amount: number;
  description: string;
  category?: string;
  createdAt: string;
  status: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expenditure'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (!profile) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', profile.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          category: doc.data().type === 'income' ? '订单结算' : '资金提现'
        } as Transaction));
        setTransactions(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [profile]);

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    const tDate = new Date(t.createdAt);
    return (tDate.getMonth() + 1) === selectedMonth;
  });

  const getTransactionInfo = (type: string, desc: string) => {
    if (desc.includes('星巴克') || desc.includes('必胜客') || desc.includes('面皮') || desc.includes('肉包') || desc.includes('陶勇')) {
      return { icon: <Utensils size={24} />, category: '餐饮美食', color: 'text-orange-500', bg: 'bg-orange-50' };
    }
    if (desc.includes('余额宝')) {
      return { icon: <Smartphone size={24} />, category: '投资理财', color: 'text-rose-500', bg: 'bg-rose-50' };
    }
    if (desc.includes('提现')) {
      return { icon: <Wallet size={24} />, category: '资金提现', color: 'text-indigo-500', bg: 'bg-indigo-50' };
    }
    if (desc.includes('卡') || desc.includes('券')) {
      return { icon: <CreditCard size={24} />, category: '生活服务', color: 'text-emerald-500', bg: 'bg-emerald-50' };
    }
    return { 
      icon: type === 'income' ? <Gift size={24} /> : <CreditCard size={24} />, 
      category: type === 'income' ? '其他收入' : '其他支出',
      color: type === 'income' ? 'text-amber-500' : 'text-slate-500',
      bg: type === 'income' ? 'bg-amber-50' : 'bg-slate-50'
    };
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return isToday ? `今天 ${timeStr}` : `${date.getMonth() + 1}-${date.getDate()} ${timeStr}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FC]">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl px-6 pt-12 pb-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)} 
            className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-50 bg-white text-slate-400 shadow-sm transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">资金明细</span>
            <button className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-slate-50 border border-slate-100 group active:scale-95 transition-all">
              <span className="text-sm font-black text-slate-900">{selectedMonth}月记录</span>
              <ChevronDown size={14} className="text-slate-400 transition-transform group-hover:rotate-180" />
            </button>
          </div>

          <button className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-50 bg-white text-slate-400 shadow-sm transition-all active:scale-90">
            <Calendar size={20} />
          </button>
        </div>

        {/* Segmented Filter */}
        <div className="relative flex p-1.5 bg-slate-100/50 rounded-[2rem] border border-slate-100">
          {[
            { id: 'all', label: '全部' },
            { id: 'income', label: '收入' },
            { id: 'expenditure', label: '支出' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id as any)}
              className={cn(
                "relative flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                filterType === type.id ? "text-indigo-600" : "text-slate-400"
              )}
            >
              {filterType === type.id && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 bg-white rounded-full shadow-lg shadow-indigo-100 border border-indigo-50"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-20">{type.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
            <div className="h-12 w-12 animate-spin rounded-3xl border-4 border-indigo-600 border-t-transparent shadow-xl" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">正在获取明细</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredTransactions.map((t, idx) => {
                const info = getTransactionInfo(t.type, t.description);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    key={t.id}
                    className="group relative flex items-center justify-between p-5 bg-white rounded-[2.5rem] border border-slate-50 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-[1.25rem] transition-all group-hover:scale-110",
                        info.bg,
                        info.color
                      )}>
                        {info.icon}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-black text-slate-800 leading-tight pr-2 line-clamp-1">
                          {t.description}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                            {info.category}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                            {formatTime(t.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={cn(
                        "text-lg font-black tracking-tighter",
                        t.type === 'income' ? "text-emerald-500" : "text-slate-800"
                      )}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                      </div>
                      <div className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md inline-block mt-1",
                        t.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {t.status === 'completed' ? '已入账' : '处理中'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-slate-50 text-slate-200 shadow-inner">
              <Search size={40} />
            </div>
            <h4 className="text-lg font-black text-slate-800 tracking-tight">暂无交易记录</h4>
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
              切换查询条件或之后再来
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
