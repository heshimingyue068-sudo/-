import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { formatCurrency, cn } from '../../lib/utils';
import { 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  User,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CardItem {
  id: string;
  cardNo?: string;
  cardPwd?: string;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute' | 'expired' | 'used' | 'invalid';
  remark?: string;
}

interface UserProfile {
  uid: string;
  realName?: string;
  alipayAccount?: string;
}

interface Order {
  id: string;
  userId: string;
  brandName: string;
  couponType: string;
  faceValue: number;
  expectedAmount: number;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute';
  createdAt: string;
  speed: string;
  cards?: CardItem[];
  closedReason?: string;
  disputeDetails?: string;
  // Legacy fields
  cardNo?: string;
  cardPwd?: string;
  qrCodeUrl?: string;
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReasonInput, setCloseReasonInput] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'orders', id));
        if (snap.exists()) {
          const orderData = { id: snap.id, ...snap.data() } as Order;
          setOrder(orderData);
          
          // Fetch user profile
          const userSnap = await getDoc(doc(db, 'users', orderData.userId));
          if (userSnap.exists()) {
            setUserProfile({ uid: userSnap.id, ...userSnap.data() } as UserProfile);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const updateOrderStatus = async (status: Order['status'], reason?: string) => {
    if (!order) return;
    
    setUpdating(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);
        const userRef = doc(db, 'users', order.userId);
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("用户不存在");

        const updateData: any = { 
          status, 
          updatedAt: serverTimestamp() 
        };

        if (reason) {
          if (status === 'closed') updateData.closedReason = reason;
          if (status === 'dispute') updateData.disputeDetails = reason;
        }

        transaction.update(orderRef, updateData);

        if (status === 'completed' && order.status !== 'completed') {
          const currentBalance = userDoc.data().balance || 0;
          transaction.update(userRef, { 
            balance: currentBalance + order.expectedAmount 
          });
        }
      });
      
      setOrder(prev => prev ? { 
        ...prev, 
        status, 
        closedReason: status === 'closed' ? reason : prev.closedReason,
        disputeDetails: status === 'dispute' ? reason : prev.disputeDetails
      } : null);
      setShowCloseModal(false);
      setCloseReasonInput('');
    } catch (err) {
      console.error(err);
      alert('操作失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setUpdating(false);
    }
  };

  const updateCardStatus = async (cardIndex: number, newStatus: CardItem['status'], remark?: string) => {
    if (!order || !order.cards) return;
    
    // Check if balance update is needed
    const cardToUpdate = order.cards[cardIndex];
    if (!cardToUpdate) return;
    
    // Requirement: completed, closed, dispute need remark to be filled
    const finalRemark = (remark !== undefined ? remark : cardToUpdate.remark) || "";
    if (['completed', 'closed', 'dispute'].includes(newStatus) && !finalRemark.trim()) {
      alert(`操作受阻：设置为“${newStatus === 'completed' ? '已完成' : newStatus === 'closed' ? '已关闭' : '纠纷中'}”状态时必须填写核销备注/说明原因`);
      return;
    }

    const isBecomingCompleted = newStatus === 'completed' && cardToUpdate.status !== 'completed';
    const cardValue = order.expectedAmount / (order.cards.length || 1);

    setUpdating(true);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);
        const userRef = doc(db, 'users', order.userId);
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("用户不存在");

        const updatedCards = order.cards!.map((card, idx) => {
          if (idx === cardIndex) {
            return {
              ...card,
              status: newStatus,
              remark: remark ?? card.remark ?? ""
            };
          }
          return card;
        });

        // Sanitize
        const sanitizedCards = updatedCards.map(card => {
          const s: any = { ...card };
          Object.keys(s).forEach(k => { if (s[k] === undefined) delete s[k]; });
          return s;
        });

        transaction.update(orderRef, {
          cards: sanitizedCards,
          updatedAt: serverTimestamp()
        });

        if (isBecomingCompleted) {
          const currentBalance = userSnap.data().balance || 0;
          transaction.update(userRef, {
            balance: currentBalance + cardValue
          });
        }
      });

      // Update local state
      const updatedCards = order.cards.map((card, idx) => {
        if (idx === cardIndex) {
          return { ...card, status: newStatus, remark: remark ?? card.remark ?? "" };
        }
        return card;
      });
      setOrder({ ...order, cards: updatedCards });
    } catch (err) {
      console.error(err);
      alert('操作失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <XCircle size={48} className="text-rose-500" />
        <h2 className="text-xl font-black text-slate-800">订单不存在</h2>
        <button onClick={() => navigate('/admin/orders')} className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all active:scale-95">返回订单列表</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-20 px-4 sm:px-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/orders')}
            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">订单管理</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Order Reference</span>
              <span className="text-[10px] font-black text-indigo-600 font-mono tracking-tighter bg-indigo-50 px-2 py-0.5 rounded-md uppercase">#{order.id.slice(-8)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {order.status === 'consignment' && (
            <button 
              disabled={updating}
              onClick={() => updateOrderStatus('settling')}
              className="h-12 px-6 rounded-2xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              开始结算
            </button>
          )}
          {(order.status === 'consignment' || order.status === 'settling') && (
            <button 
              disabled={updating}
              onClick={() => updateOrderStatus('completed')}
              className="h-12 px-6 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              核销成功
            </button>
          )}
          {(order.status === 'consignment' || order.status === 'settling') && (
            <button 
              disabled={updating}
              onClick={() => setShowCloseModal(true)}
              className="h-12 px-6 rounded-2xl border-2 border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
            >
              异常设置
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="space-y-8 mt-10">
        
        {/* GROUP 1: 订单核心状态与基础信息 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <div className="flex items-center gap-3 mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">01 订单基础概况 (汇总)</h3>
            <div className="h-px flex-1 bg-slate-100" />
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
               <span className="text-[10px] font-black uppercase text-slate-300">主订单状态</span>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{order.status === 'consignment' ? '核销中' : order.status === 'completed' ? '已收录' : order.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">提交品牌</p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black italic">
                  {order.brandName[0]}
                </div>
                <p className="text-lg font-black text-slate-800">{order.brandName}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">总面值</p>
              <p className="text-3xl font-black text-slate-800 tracking-tighter">¥{order.faceValue}</p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">总计预估回款</p>
              <p className="text-3xl font-black text-indigo-600 tracking-tighter">¥{order.expectedAmount.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">回款速度</p>
              <p className={cn(
                "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                order.speed === 'fast' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
              )}>
                {order.speed === 'fast' ? '极速回款' : '普通结算'}
              </p>
            </div>
          </div>
        </section>

        {/* GROUP 2: 用户信息与资金流向 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-slate-200" />
          <div className="flex items-center gap-3 mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">02 提交者账户信息</h3>
            <div className="h-px flex-1 bg-slate-100" />
            <User size={18} className="text-slate-300" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 text-left">持卡人姓名</p>
              <p className="text-sm font-black text-slate-700 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">{userProfile?.realName || '尚未实名'}</p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 text-left">结算支付宝 (Alipay)</p>
              <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 group">
                <p className="text-sm font-black text-indigo-700 font-mono">{userProfile?.alipayAccount || '-'}</p>
                {userProfile?.alipayAccount && (
                  <button onClick={() => copyToClipboard(userProfile.alipayAccount!)} className="text-indigo-400 hover:text-indigo-600 p-1">
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 text-left">总计提交时间</p>
              <p className="text-sm font-bold text-slate-600">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* GROUP 3: 核销明细管理 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">03 子订单核销矩阵</h3>
              <div className="h-4 w-px bg-slate-100 mx-2 hidden sm:block" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">子订单细分: {order.cards?.length || 1} 份</span>
            </div>
            
            <div className="flex gap-2">
               <button 
                  onClick={() => updateOrderStatus('completed')}
                  className="px-4 py-2 bg-emerald-600 text-[10px] font-black uppercase text-white rounded-xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
               >
                  标记整单完成
               </button>
            </div>
          </div>

          <div className="space-y-4">
            {order.couponType === 'card_password' ? (
              order.cards && order.cards.length > 0 ? (
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/30">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">卡号/卡密</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">核销备注</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">预计结算</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">状态</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">精细控制</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.cards.map((card, idx) => {
                        const statusColors: any = {
                          completed: "bg-emerald-50 text-emerald-600",
                          settling: "bg-blue-50 text-blue-600",
                          expired: "bg-slate-100 text-slate-500",
                          used: "bg-amber-50 text-amber-600",
                          invalid: "bg-rose-50 text-rose-600",
                          consignment: "bg-amber-100 text-amber-700",
                          closed: "bg-slate-200 text-slate-700",
                          dispute: "bg-indigo-50 text-indigo-700"
                        };
                        const statusLabels: any = {
                          completed: "已完成",
                          settling: "结算中",
                          expired: "已过期",
                          used: "已使用",
                          invalid: "已失效",
                          consignment: "寄售中",
                          closed: "已关闭",
                          dispute: "纠纷中"
                        };
                        
                        return (
                          <tr key={idx} className="hover:bg-white transition-colors group">
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-black text-slate-300 italic">{(idx + 1).toString().padStart(2, '0')}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {card.cardNo && (
                                  <div className="flex items-center gap-1.5 group/copy">
                                    <span className="text-[8px] font-bold text-slate-300 uppercase">NO.</span>
                                    <span className="text-[10px] font-bold text-slate-600 font-mono tracking-tight">{card.cardNo}</span>
                                    <button onClick={() => copyToClipboard(card.cardNo!)} className="opacity-0 group-hover/copy:opacity-100 text-indigo-300">
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                )}
                                {card.cardPwd && (
                                  <div className="flex items-center gap-1.5 group/copy">
                                    <span className="text-[8px] font-bold text-indigo-300 uppercase">PW.</span>
                                    <span className="text-[11px] font-black text-indigo-600 font-mono tracking-widest">{card.cardPwd}</span>
                                    <button onClick={() => copyToClipboard(card.cardPwd!)} className="opacity-0 group-hover/copy:opacity-100 text-indigo-400">
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="text"
                                placeholder="添加核销备注..."
                                className="w-full bg-slate-100/50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 placeholder:text-slate-300 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all border border-transparent"
                                value={card.remark || ''}
                                onChange={(e) => updateCardStatus(idx, card.status, e.target.value)}
                              />
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                  <span className="text-xs font-black text-emerald-600 tracking-tighter">¥{(order.expectedAmount / (order.cards?.length || 1)).toFixed(2)}</span>
                                  <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">EST. SETTLEMENT</span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                                statusColors[card.status] || "bg-slate-50 text-slate-400"
                              )}>
                                {statusLabels[card.status] || card.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1 flex-wrap max-w-[200px]">
                                {[
                                  { id: 'consignment', label: '寄售', bg: 'hover:bg-amber-600' },
                                  { id: 'settling', label: '结算', bg: 'hover:bg-blue-600' },
                                  { id: 'completed', label: '完成', bg: 'hover:bg-emerald-600' },
                                  { id: 'closed', label: '关闭', bg: 'hover:bg-slate-600' },
                                  { id: 'dispute', label: '纠纷', bg: 'hover:bg-indigo-600' },
                                  { id: 'invalid', label: '失效', bg: 'hover:bg-rose-600' }
                                ].map((btn) => (
                                  <button
                                    key={btn.id}
                                    onClick={() => updateCardStatus(idx, btn.id as any)}
                                    className={cn(
                                      "px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all active:scale-90 border border-slate-100 text-slate-400 hover:text-white",
                                      btn.bg,
                                      card.status === btn.id && "bg-slate-800 text-white border-transparent"
                                    )}
                                  >
                                    {btn.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                  <p className="text-xs font-bold text-slate-300 italic uppercase tracking-[0.2em]">没有卡券详细记录数据</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 border-b pb-2">卡券核销凭证预览</p>
                {order.qrCodeUrl ? (
                  <div className="relative group">
                    <img src={order.qrCodeUrl} alt="QR Code" className="max-w-sm rounded-[2.5rem] shadow-2xl border-8 border-white ring-1 ring-slate-100" />
                    <div className="absolute inset-x-8 -bottom-4">
                      <a 
                        href={order.qrCodeUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-200"
                      >
                        <ExternalLink size={14} />
                        查看凭证全图
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-300 italic">管理员尚未上传凭证图片</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* GROUP 4: 异常原因审计 (Conditional) */}
        <AnimatePresence>
          {(order.closedReason || order.disputeDetails) && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
              <div className="flex items-center gap-3 mb-8">
                <h3 className="text-xl font-black text-rose-600 tracking-tight">04 异常说明记录</h3>
                <div className="h-px flex-1 bg-rose-50" />
                <AlertCircle size={18} className="text-rose-400" />
              </div>
              <div className="bg-rose-50 p-8 rounded-3xl border border-rose-100">
                <p className="text-sm font-black text-rose-800 leading-relaxed italic">
                  “{order.status === 'closed' ? order.closedReason : order.disputeDetails}”
                </p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* GROUP 5: 审计与规范说明 */}
        <section className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 text-center">
          <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
            <HelpCircle size={32} className="text-slate-300" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ADMIN OPERATION PROTOCOLS</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-indigo-500 uppercase mb-2">手动结算规范</p>
                <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-tight">必须确认卡券已成功消耗且无法退回后，再进行对应项或整单的状态变更。</p>
              </div>
              <div className="p-6 bg-white rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-rose-500 uppercase mb-2">不可逆操作说明</p>
                <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-tight">标记“核销成功”将立即触发系统自动向用户余额充值，此动作目前不支持在后台撤回。</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Close/Dispute Modal (Common) */}
      <AnimatePresence>
        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCloseModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-[2.5rem] bg-white p-10 shadow-2xl border border-slate-100"
            >
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 uppercase">标记异常流程</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 leading-relaxed">
                描述订单存在的具体问题，此信息将在用户端订单详情页面同步展示，作为处理凭据。
              </p>
              
              <div className="space-y-6">
                <textarea
                  value={closeReasonInput}
                  onChange={(e) => setCloseReasonInput(e.target.value)}
                  placeholder="请输入详细原因，例如：卡号格式不正确、卡密已被锁定、渠道延迟说明等..."
                  className="w-full rounded-3xl border border-slate-100 bg-slate-50 p-6 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all h-48 resize-none"
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    disabled={updating || !closeReasonInput.trim()}
                    onClick={() => updateOrderStatus('dispute', closeReasonInput)}
                    className="h-16 flex items-center justify-center rounded-3xl bg-indigo-600 text-sm font-black uppercase text-white shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                  >
                    设为争议单
                  </button>
                  <button
                    disabled={updating || !closeReasonInput.trim()}
                    onClick={() => updateOrderStatus('closed', closeReasonInput)}
                    className="h-16 flex items-center justify-center rounded-3xl bg-rose-600 text-sm font-black uppercase text-white shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:opacity-50"
                  >
                    直接关闭本单
                  </button>
                </div>
                
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="w-full h-16 flex items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-sm font-black uppercase text-slate-400 hover:bg-slate-50 transition-all active:scale-95"
                >
                  放弃本次修改
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
