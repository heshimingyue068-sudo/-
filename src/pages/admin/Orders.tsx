import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, cn } from '../../lib/utils';
import { Check, X, AlertCircle } from 'lucide-react';

interface CardItem {
  id: string;
  cardNo?: string;
  cardPwd?: string;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute' | 'expired' | 'used' | 'invalid';
}

interface Order {
  id: string;
  userId: string;
  brandName: string;
  couponType: string;
  faceValue: number;
  expectedAmount: number;
  cardNo?: string;
  cardPwd?: string;
  qrCodeUrl?: string;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute';
  createdAt: string;
  speed?: 'fast' | 'normal';
  cards?: CardItem[];
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAudit = async (orderId: string, status: 'settling' | 'completed' | 'closed' | 'dispute', cardId?: string) => {
    const statusLabels = {
      settling: '结算中',
      completed: '已完成',
      closed: '已关闭',
      dispute: '纠纷中',
      expired: '已过期',
      used: '已使用',
      invalid: '已失效'
    } as any;

    const actionMsg = cardId ? `确定要将该子订单标记为 ${statusLabels[status]} 吗？` : `确定要将【整单】标记为 ${statusLabels[status]} 吗？`;
    if (!confirm(actionMsg)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("订单不存在");
        const orderData = orderSnap.data() as Order;

        const userRef = doc(db, 'users', orderData.userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("用户不存在");

        if (cardId) {
          // Update specific card
          let cardToUpdate = (orderData.cards || []).find(c => c.id === cardId);
          if (!cardToUpdate) throw new Error("子订单不存在");

          const updatedCards = (orderData.cards || []).map(card => {
            if (card.id === cardId) return { ...card, status: status as any };
            return card;
          });
          transaction.update(orderRef, { cards: updatedCards, updatedAt: serverTimestamp() });
          
          // Only add balance if we are marking it as completed and it UNFAILS OR REPLACES a non-completed one
          if (status === 'completed' && cardToUpdate.status !== 'completed') {
            const cardValue = orderData.expectedAmount / (orderData.cards?.length || 1);
            const currentBalance = userDoc.data().balance || 0;
            transaction.update(userRef, { balance: currentBalance + cardValue });
          }
        } else {
          // Update main order
          const cardsToPay = (orderData.cards || []).filter(c => c.status !== 'completed');
          const amountToPay = cardsToPay.length > 0 
            ? (orderData.expectedAmount / (orderData.cards?.length || 1)) * cardsToPay.length 
            : (orderData.status !== 'completed' ? orderData.expectedAmount : 0);

          const allCompletedCards = (orderData.cards || []).map(card => ({ ...card, status: 'completed' as const }));
          transaction.update(orderRef, { 
            status, 
            cards: allCompletedCards,
            updatedAt: serverTimestamp() 
          });
          
          if (status === 'completed' && amountToPay > 0) {
            const currentBalance = userDoc.data().balance || 0;
            transaction.update(userRef, { balance: currentBalance + amountToPay });
          }
        }
      });
    } catch (err) {
      console.error(err);
      alert('操作失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleCardStatusUpdate = async (orderId: string, cardId: string, newStatus: CardItem['status']) => {
    await handleAudit(orderId, newStatus as any, cardId);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'consignment': return { label: '待核销', color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'settling': return { label: '待结算', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'completed': return { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'closed': return { label: '已关闭', color: 'text-slate-600', bg: 'bg-slate-50' };
      case 'dispute': return { label: '纠纷中', color: 'text-rose-600', bg: 'bg-rose-50' };
      case 'expired': return { label: '已过期', color: 'text-slate-400', bg: 'bg-slate-100' };
      case 'used': return { label: '已使用', color: 'text-amber-500', bg: 'bg-amber-100' };
      case 'invalid': return { label: '已失效', color: 'text-rose-400', bg: 'bg-rose-100' };
      default: return { label: status, color: 'text-slate-400', bg: 'bg-slate-50' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">管理工作台</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mt-2">订单审计与资产回收中心</p>
        </div>
        <div className="flex gap-4">
           <div className="rounded-2xl bg-white px-6 py-3 shadow-xl shadow-slate-200 border border-slate-50">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">待审订单</div>
              <div className="text-2xl font-black text-indigo-600 tracking-tighter">
                {orders.filter(o => o.status === 'consignment' || (o.cards && o.cards.some(c => c.status === 'consignment'))).length}
              </div>
           </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200 border border-slate-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">订单标的</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">金额数据</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">子订单概况</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">时间</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((order) => {
                const isExpanded = expandedOrders.includes(order.id);
                return (
                  <Fragment key={order.id}>
                    <tr className={cn("group hover:bg-slate-50 transition-all duration-300", isExpanded && "bg-slate-50/50")}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg font-black italic text-indigo-600 border border-indigo-100 shadow-sm">
                            {order.brandName[0]}
                          </div>
                          <div>
                            <div className="font-black text-slate-800 tracking-tight">{order.brandName}</div>
                            <div className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">ID: {order.id.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-slate-800 tracking-tighter">¥{order.faceValue}</div>
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">预估: ¥{order.expectedAmount.toFixed(2)}</div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => toggleExpand(order.id)}
                          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
                        >
                          {order.cards?.length || 1} 份明细
                          <div className={cn("transition-transform", isExpanded ? "rotate-180" : "")}>↓</div>
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                          {new Date(order.createdAt).toLocaleDateString()}
                          <br />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                            className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
                          >
                            查看详情
                          </button>
                          <button
                            onClick={() => handleAudit(order.id, 'completed')}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 text-[10px] font-black uppercase text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                          >
                            整单核销
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Sub-orders Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-8 py-0 bg-slate-50/30">
                          <div className="py-6 space-y-3">
                            {(order.cards && order.cards.length > 0 ? order.cards : [{ id: 'LEGACY', cardNo: order.cardNo, cardPwd: order.cardPwd, status: order.status as any }]).map((card, idx) => {
                              const sInfo = getStatusInfo(card.status);
                              return (
                                <div key={card.id || idx} className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-100 shadow-sm group/sub">
                                  <div className="flex items-center gap-6">
                                    <div className="text-[10px] font-black italic text-indigo-300">#{idx + 1}</div>
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-4">
                                        {card.cardNo && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] font-black uppercase text-slate-300">卡号:</span>
                                            <span className="text-[10px] font-bold text-slate-600 font-mono tracking-wider">{card.cardNo}</span>
                                          </div>
                                        )}
                                        {card.cardPwd && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] font-black uppercase text-slate-300">卡密:</span>
                                            <span className="text-[10px] font-bold text-indigo-500 font-mono tracking-widest">{card.cardPwd}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                                          <span className="text-[8px] font-black uppercase text-emerald-600/40">预计结算</span>
                                          <span className="text-[11px] font-black text-emerald-600 font-mono">¥{(order.expectedAmount / (order.cards?.length || 1)).toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                    <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest", sInfo.bg, sInfo.color)}>
                                      {sInfo.label}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleCardStatusUpdate(order.id, card.id, 'completed')}
                                        className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleCardStatusUpdate(order.id, card.id, 'invalid')}
                                        className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                      <button 
                                         onClick={() => handleCardStatusUpdate(order.id, card.id, 'used')}
                                         className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-colors"
                                      >
                                        <AlertCircle size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">正在加载订单...</p>
          </div>
        )}
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200">
                <AlertCircle size={40} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">数据库中暂无订单</p>
          </div>
        )}
      </div>
    </div>
  );
}
