import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Users, Search, Shield, UserX, UserCheck, Eye, X, ShoppingCart, Wallet, CreditCard, Calendar, Smartphone, User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phoneNumber?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  alipayAccount?: string;
  realName?: string;
  balance?: number;
  createdAt?: string;
}

interface Order {
  id: string;
  brandName: string;
  faceValue: number;
  expectedAmount: number;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: 'income' | 'expenditure';
  amount: number;
  description: string;
  createdAt: string;
  status: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail View State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Detail Filtering State
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Effect to re-fetch details when date range or selected user changes
  useEffect(() => {
    if (selectedUser) {
      fetchUserDetails(selectedUser);
    }
  }, [selectedUser?.uid, dateRange.start, dateRange.end]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const action = user.isBanned ? '启用' : '禁用';
    if (!confirm(`确定要${action}用户 ${user.displayName} 吗？`)) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { isBanned: !user.isBanned });
      fetchUsers();
      if (selectedUser?.uid === user.uid) {
        setSelectedUser({ ...selectedUser, isBanned: !user.isBanned });
      }
    } catch (err) {
      console.error(err);
      alert('操作失败');
    }
  };

  const fetchUserDetails = async (user: UserProfile) => {
    setLoadingDetails(true);
    try {
      // Start of day for start date, end of day for end date
      const startDateTime = new Date(dateRange.start);
      startDateTime.setHours(0, 0, 0, 0);
      
      const endDateTime = new Date(dateRange.end);
      endDateTime.setHours(23, 59, 59, 999);

      // Fetch Orders
      const oQuery = query(
        collection(db, 'orders'), 
        where('userId', '==', user.uid),
        where('createdAt', '>=', startDateTime.toISOString()),
        where('createdAt', '<=', endDateTime.toISOString()),
        orderBy('createdAt', 'desc')
      );
      const oSnap = await getDocs(oQuery);
      setUserOrders(oSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));

      // Fetch Transactions
      const tQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', startDateTime.toISOString()),
        where('createdAt', '<=', endDateTime.toISOString()),
        orderBy('createdAt', 'desc')
      );
      const tSnap = await getDocs(tQuery);
      setUserTransactions(tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filtered = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.alipayAccount?.includes(searchTerm) ||
    u.phoneNumber?.includes(searchTerm)
  );

  return (
    <div className="flex-1 space-y-8 p-12 bg-[#F8F9FC] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">用户管理</h2>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">查看与管理平台所有用户身份及资金详情</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            className="w-96 rounded-2xl bg-white border border-slate-100 pl-14 pr-6 py-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 shadow-sm transition-all"
            placeholder="搜索姓名 / 邮箱 / 支付宝 / 手机号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl shadow-slate-200/40 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">序号</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 uppercase tracking-widest">注册时间 / 手机号</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">支付宝认证</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">余额</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">状态</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((u, idx) => (
              <tr key={u.uid} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-8 py-6 text-sm font-black text-slate-300">
                  #{idx + 1}
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-black text-slate-800">{new Date(u.createdAt || '').toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400">{u.phoneNumber || '未提供手机号'}</p>
                  </div>
                </td>
                <td className="px-8 py-6">
                  {u.alipayAccount ? (
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-800">{u.realName}</p>
                      <p className="text-[10px] font-bold text-[#00A3FF] uppercase tracking-widest">{u.alipayAccount}</p>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">未认证</span>
                  )}
                </td>
                <td className="px-8 py-6">
                  <span className="text-lg font-black text-indigo-600 tracking-tighter">¥{(u.balance || 0).toFixed(2)}</span>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className={cn(
                    "inline-flex rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                    u.isBanned ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {u.isBanned ? '已禁用' : '正常'}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 hover:bg-white hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-90"
                      title="查看详情"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-sm border",
                        u.isBanned ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white" : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white"
                      )}
                      title={u.isBanned ? "启用" : "禁用"}
                    >
                      {u.isBanned ? <UserCheck size={18} /> : <UserX size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full w-full max-w-4xl bg-slate-50 shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={selectedUser.photoURL} alt="" className="h-12 w-12 rounded-2xl shadow-sm border border-slate-100" />
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedUser.displayName}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 space-y-10">
                {/* Date Filter & Stats Overview */}
                <div className="flex items-center justify-between gap-6">
                   <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2 px-3">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">时间筛选</span>
                      </div>
                      <input 
                        type="date"
                        className="bg-slate-50 border-none rounded-xl text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      />
                      <span className="text-slate-300 font-bold">至</span>
                      <input 
                        type="date"
                        className="bg-slate-50 border-none rounded-xl text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      />
                   </div>

                   <div className="flex gap-4">
                      <div className="px-6 py-3 bg-white rounded-2xl border border-slate-100 flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">区域内订单</span>
                        <span className="text-lg font-black text-slate-900">{userOrders.length}</span>
                      </div>
                      <div className="px-6 py-3 bg-white rounded-2xl border border-slate-100 flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">区域内变动</span>
                        <span className="text-lg font-black text-indigo-600">¥{userTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0).toFixed(2)}</span>
                      </div>
                   </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="rounded-[2.5rem] bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-100">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">当前余额</p>
                    <h4 className="text-3xl font-black tracking-tighter">¥{(selectedUser.balance || 0).toFixed(2)}</h4>
                  </div>
                  <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">累计订单</p>
                    <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{userOrders.length}</h4>
                  </div>
                   <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">支付宝状态</p>
                    <h4 className={cn(
                      "text-[15px] font-black uppercase tracking-widest",
                      selectedUser.alipayAccount ? "text-[#00A3FF]" : "text-slate-300"
                    )}>
                      {selectedUser.alipayAccount ? '已实名认证' : '未认证'}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10">
                  {/* Order History */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                       <ShoppingCart size={20} className="text-slate-900" />
                       <h5 className="text-lg font-black text-slate-900 tracking-tight">订单记录</h5>
                    </div>
                    {loadingDetails ? (
                      <div className="h-40 flex items-center justify-center opacity-40">
                        <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userOrders.length > 0 ? userOrders.map(order => (
                          <div key={order.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                            <div>
                               <p className="text-sm font-black text-slate-800">{order.brandName}</p>
                               <p className="text-[10px] font-bold text-slate-400 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-slate-900">¥{order.expectedAmount}</p>
                               <span className="text-[8px] font-black uppercase tracking-widest text-[#00A3FF]">面值:{order.faceValue}</span>
                            </div>
                          </div>
                        )) : (
                          <div className="py-10 text-center rounded-3xl border-2 border-dashed border-slate-100 text-slate-300 font-bold text-xs">
                            暂无订单记录
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Transaction History */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                       <Wallet size={20} className="text-slate-900" />
                       <h5 className="text-lg font-black text-slate-900 tracking-tight">资金明细</h5>
                    </div>
                    {loadingDetails ? (
                      <div className="h-40 flex items-center justify-center opacity-40">
                        <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userTransactions.length > 0 ? userTransactions.map(t => (
                          <div key={t.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                             <div className="flex items-center gap-3">
                               <div className={cn(
                                 "h-10 w-10 rounded-xl flex items-center justify-center",
                                 t.type === 'income' ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500"
                               )}>
                                 {t.type === 'income' ? <Plus size={18} /> : <X size={18} />}
                               </div>
                               <div>
                                  <p className="text-[13px] font-black text-slate-800">{t.description}</p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                               </div>
                             </div>
                             <p className={cn(
                               "text-sm font-black tracking-tighter",
                               t.type === 'income' ? "text-emerald-500" : "text-slate-900"
                             )}>
                               {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                             </p>
                          </div>
                        )) : (
                          <div className="py-10 text-center rounded-3xl border-2 border-dashed border-slate-100 text-slate-300 font-bold text-xs">
                            暂无资金记录
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
