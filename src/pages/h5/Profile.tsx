import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserProfile } from '../../hooks/useAuth';
import { auth, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { cn, formatCurrency } from '../../lib/utils';
import { Wallet, Settings, ShieldCheck, HelpCircle, Phone, LogOut, ChevronRight, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CardItem {
  id: string;
  cardNo?: string;
  cardPwd?: string;
  status: string;
  withdrawn?: boolean;
}

interface Order {
  id: string;
  brandName: string;
  expectedAmount: number;
  faceValue: number;
  status: string;
  createdAt: string;
  withdrawn?: boolean;
  cards?: CardItem[];
}

interface WithdrawableItem {
  id: string; // Unique key for selection
  mainOrderId: string;
  cardId?: string;
  brandName: string;
  amount: number;
  faceValue: number;
  createdAt: string;
  isSubOrder: boolean;
  cardIndex?: number;
  cardNo?: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [stats, setStats] = useState({ pending: 0, completed: 0 });
  const [withdrawableItems, setWithdrawableItems] = useState<WithdrawableItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!profile) return;
    const fetchStats = async () => {
      const q = query(
        collection(db, 'orders'), 
        where('userId', '==', profile.uid)
      );
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Order);
      setAllOrders(orders);
      
      const items: WithdrawableItem[] = [];
      orders.forEach(order => {
        if (order.cards && order.cards.length > 0) {
          order.cards.forEach((card, index) => {
            if (card.status === 'completed' && !card.withdrawn) {
              items.push({
                id: `${order.id}-${card.id || index}`,
                mainOrderId: order.id,
                cardId: card.id,
                brandName: order.brandName,
                amount: order.expectedAmount / order.cards!.length,
                faceValue: order.faceValue / order.cards!.length,
                createdAt: order.createdAt,
                isSubOrder: true,
                cardIndex: index + 1,
                cardNo: card.cardNo
              });
            }
          });
        } else if (order.status === 'completed' && !order.withdrawn) {
          // Legacy support
          items.push({
            id: order.id,
            mainOrderId: order.id,
            brandName: order.brandName,
            amount: order.expectedAmount,
            faceValue: order.faceValue,
            createdAt: order.createdAt,
            isSubOrder: false
          });
        }
      });
      
      const orderBalance = items.reduce((sum, item) => sum + item.amount, 0);
      setAvailableBalance(orderBalance);
      
      setStats({
        pending: orders.filter(o => ['consignment', 'settling', 'dispute'].includes(o.status)).length,
        completed: items.length
      });
      setWithdrawableItems(items);
    };
    fetchStats();
  }, [profile, showWithdraw]);

  useEffect(() => {
    const total = withdrawableItems
      .filter(item => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.amount, 0);
    setAmount(total.toFixed(2));
  }, [selectedItemIds, withdrawableItems]);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleWithdraw = async () => {
    if (!profile || selectedItemIds.length === 0) return;
    const totalAmount = parseFloat(amount);
    
    setSubmitting(true);
    try {
      // 1. Create withdrawal record
      const withdrawalRef = await addDoc(collection(db, 'withdrawals'), {
        userId: profile.uid,
        amount: totalAmount,
        selectedItems: withdrawableItems.filter(i => selectedItemIds.includes(i.id)),
        realName: profile.realName || '',
        alipayAccount: profile.alipayAccount || '',
        method: 'alipay',
        targetAccount: profile.alipayAccount || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 2. Create Transaction record
      batch.set(doc(collection(db, 'transactions')), {
        userId: profile.uid,
        amount: totalAmount,
        type: 'expenditure',
        description: '申请提现',
        sourceId: withdrawalRef.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // 3. Mark items as withdrawn
      // Group selections by orderId
      const selectionsByOrder: Record<string, string[]> = {};
      selectedItemIds.forEach(id => {
        const item = withdrawableItems.find(i => i.id === id);
        if (item) {
          if (!selectionsByOrder[item.mainOrderId]) {
            selectionsByOrder[item.mainOrderId] = [];
          }
          if (item.cardId) {
             selectionsByOrder[item.mainOrderId].push(item.cardId);
          } else if (item.isSubOrder) {
             // If cardId is missing, use internal logic maybe? (should have cardId)
             // Fallback to finding by index if needed, but for now we assume cardId exists or use index
          }
        }
      });

      // Process batches
      const processedOrderIds = new Set<string>();
      
      // Update each involved order
      for (const orderId in selectionsByOrder) {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) continue;

        if (order.cards && order.cards.length > 0) {
          const updatedCards = order.cards.map(card => {
            if (selectionsByOrder[orderId].includes(card.id)) {
              return { ...card, withdrawn: true, withdrawalId: withdrawalRef.id };
            }
            return card;
          });
          
          batch.update(doc(db, 'orders', order.id), { 
            cards: updatedCards 
          });
        } else {
          // Legacy order
          batch.update(doc(db, 'orders', order.id), { 
            withdrawn: true,
            withdrawalId: withdrawalRef.id
          });
        }
        processedOrderIds.add(orderId);
      }

      // Check if any legacy-only selected orders were missed
      selectedItemIds.forEach(id => {
        const item = withdrawableItems.find(i => i.id === id);
        if (item && !item.isSubOrder && !processedOrderIds.has(item.mainOrderId)) {
           batch.update(doc(db, 'orders', item.mainOrderId), { 
             withdrawn: true,
             withdrawalId: withdrawalRef.id
           });
        }
      });

      await batch.commit();

      alert('申请已提交，请等待处理');
      setShowWithdraw(false);
      setSelectedItemIds([]);
      setAmount('0.00');
    } catch (err) {
      console.error(err);
      alert('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const { seedDatabase } = await import('../../lib/seedData');
      await seedDatabase(profile.uid);
      alert('数据初始化成功！');
    } catch (err) {
      console.error(err);
      alert('初始化失败');
    } finally {
      setSeeding(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('virtual_user_id');
    signOut(auth);
    window.location.href = '/login';
  };

  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc]">
      {/* Redesigned Profile Header Card */}
      <div className="px-6 pt-12 pb-6">
        <div className="relative overflow-hidden rounded-[3rem] bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl"></div>
          
          <div className="relative z-10">
            {/* Top Row: User Info */}
            <div className="flex items-center gap-5 mb-10">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-white/20 p-1 backdrop-blur-sm border border-white/30">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-white text-xl font-black text-indigo-600">
                    {profile.displayName?.[0] || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-black tracking-tight">{profile.displayName || '未定义昵称'}</h2>
                <div className="flex flex-col gap-1 mt-1 opacity-80">
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <Phone size={10} />
                    <span>{profile.phoneNumber || '未绑定手机'}</span>
                  </div>
                  {!profile.email.includes('@phone.user') && (
                    <p className="text-[10px] font-bold uppercase tracking-wider">{profile.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Row: Balance Display */}
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/60 mb-1">
                  <Wallet size={12} />
                  <span>账户余额</span>
                </div>
                <div className="text-4xl font-black tracking-tighter">
                  <span className="text-xl align-top mt-1 mr-1 text-indigo-200">¥</span>
                  {availableBalance.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => setShowWithdraw(true)}
                className="rounded-xl bg-white px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-lg transition-all active:scale-95"
              >
                申请提现
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-6 flex-1 space-y-8 pb-32">
        {/* Action Menu moved directly after header */}
        <div className="space-y-4">
          <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">账户设置</h3>
          <div className="rounded-[2.5rem] bg-white p-3 shadow-xl shadow-slate-200 border border-slate-50">
            {[
              { icon: Wallet, label: '资金明细', color: 'text-emerald-500', action: () => navigate('/transaction-history') },
              { icon: Bell, label: '消息通知', color: 'text-blue-500', action: () => {} },
              { icon: HelpCircle, label: '帮助中心', color: 'text-amber-500', action: () => {} },
              { icon: HelpCircle, label: '联系我们', color: 'text-rose-500', action: () => {} },
            ].map((item, idx) => (
              <button key={idx} onClick={item.action} className="group flex w-full items-center gap-4 p-4 hover:bg-slate-50 transition-all rounded-[1.5rem]">
                <div className={cn("p-2.5 rounded-xl bg-slate-50 transition-colors group-hover:bg-indigo-600 group-hover:text-white", item.color)}>
                  <item.icon size={20} />
                </div>
                <span className="flex-1 text-left text-sm font-black text-slate-700 tracking-tight">{item.label}</span>
                <ChevronRight size={18} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="flex w-full items-center justify-center gap-2 rounded-[2rem] py-5 text-xs font-black uppercase tracking-widest text-indigo-600 shadow-xl shadow-indigo-100 bg-white border border-indigo-50 transition-all hover:bg-indigo-50 active:scale-95 disabled:opacity-50"
        >
          <Settings size={18} className={cn(seeding && "animate-spin")} />
          {seeding ? '正在初始化...' : '初始化演示数据'}
        </button>

        {profile.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex w-full items-center justify-center gap-2 rounded-[2rem] py-5 text-xs font-black uppercase tracking-widest text-slate-600 shadow-xl shadow-slate-100 bg-white border border-slate-50 transition-all hover:bg-slate-50 active:scale-95"
          >
            <Settings size={18} />
            管理后台
          </button>
        )}

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-[2rem] py-5 text-xs font-black uppercase tracking-widest text-rose-500 shadow-xl shadow-rose-100 bg-white border border-rose-50 transition-all hover:bg-rose-50 active:scale-95"
        >
          <LogOut size={18} />
          退出登录
        </button>
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md rounded-[3rem] bg-white p-10 shadow-2xl shadow-slate-900/20"
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">提现申请</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">提现至支付宝</p>
                </div>
                <button onClick={() => setShowWithdraw(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                   <ChevronRight className="rotate-90" size={20} />
                </button>
              </div>
              
              <div className="mb-10 space-y-6">
                {!profile.alipayAccount ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                      <HelpCircle size={40} />
                    </div>
                    <h4 className="text-lg font-black text-slate-800">未设置账户信息</h4>
                    <p className="mt-2 text-xs font-bold text-slate-400">您需要先绑定支付宝账号才能申请提现</p>
                    <button
                      onClick={() => navigate('/bind-alipay')}
                      className="mt-8 w-full rounded-2xl bg-indigo-600 py-5 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-indigo-100 transition-all active:scale-95"
                    >
                      立刻去绑定支付宝
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <label className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">支付宝姓名</label>
                        <p className="text-sm font-black text-slate-700">{profile.realName || '已认证'}</p>
                      </div>
                      <div className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <label className="mb-1 block text-[8px] font-black uppercase tracking-widest text-slate-400">提现账号 (ID)</label>
                        <p className="text-sm font-black text-slate-700">{profile.alipayAccount}</p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">选择已完成的子订单</label>
                      <div className="max-h-[30vh] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                        {withdrawableItems.length > 0 ? (
                          withdrawableItems.map((item) => (
                            <div 
                              key={item.id} 
                              onClick={() => toggleItemSelection(item.id)}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98] cursor-pointer",
                                selectedItemIds.includes(item.id) 
                                  ? "bg-indigo-50 border-indigo-200" 
                                  : "bg-slate-50 border-transparent hover:border-slate-100"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                  selectedItemIds.includes(item.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-200"
                                )}>
                                  {selectedItemIds.includes(item.id) && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-slate-700">{item.brandName}</p>
                                    {item.isSubOrder && (
                                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[8px] font-black text-indigo-600">
                                        #{item.cardIndex}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                    {new Date(item.createdAt).toLocaleDateString()} · 面值 ¥{item.faceValue.toFixed(0)}
                                  </p>
                                  {item.cardNo && (
                                    <p className="mt-0.5 text-[8px] font-medium text-slate-300 font-mono">
                                      卡号: {item.cardNo.slice(0, 8)}...
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-indigo-600">¥{item.amount.toFixed(2)}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 text-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-100 text-slate-400">
                            <p className="text-xs font-bold">暂无已完成的子订单</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">提现金额</label>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">已选 {selectedItemIds.length} 份</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-800">¥</span>
                        <input
                          type="text"
                          readOnly
                          placeholder="0.00"
                          className="w-full rounded-[2rem] bg-indigo-50/50 p-6 pl-10 text-3xl font-black tracking-tighter outline-none border-2 border-transparent"
                          value={amount}
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">账户可提现余额: ¥{availableBalance.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">最低提现 ¥10.00</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {profile.alipayAccount && (
                <button
                  onClick={handleWithdraw}
                  disabled={submitting || selectedItemIds.length === 0 || parseFloat(amount) < 10}
                  className="w-full rounded-2xl bg-indigo-600 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:grayscale"
                >
                  {submitting ? '提现中...' : '提交提现申请'}
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
