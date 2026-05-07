import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

interface CardItem {
  id: string;
  cardNo?: string;
  cardPwd?: string;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute' | 'expired' | 'used' | 'invalid';
  phone?: string;
  location?: string;
  skuName?: string;
  productName?: string;
  claimTime?: string;
  usageTime?: string;
  usageStore?: string;
  isInvalidated?: boolean;
  invalidatedTime?: string;
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
  const [activeTab, setActiveTab] = useState<'all' | 'consignment' | 'settling' | 'completed' | 'dispute' | 'closed'>('all');

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredOrders = activeTab === 'all' 
    ? orders 
    : orders.filter(o => o.status === activeTab);

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">订单管理</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mt-1">后台订单审计与结算中心</p>
        </div>
        <div className="flex gap-4">
           <div className="rounded-2xl bg-white px-6 py-2 shadow-sm border border-slate-100">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">待处理</div>
              <div className="text-xl font-black text-indigo-600 tracking-tighter">
                {orders.filter(o => o.status === 'consignment' || o.status === 'settling').length}
              </div>
           </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-slate-100">
        {[
          { id: 'all', label: '所有订单' },
          { id: 'consignment', label: '寄售中' },
          { id: 'settling', label: '结算中' },
          { id: 'completed', label: '交易完成' },
          { id: 'dispute', label: '纠纷中' },
          { id: 'closed', label: '已关闭' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative",
              activeTab === tab.id ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Grid Header & List Container */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1500px]">
             <div className="grid grid-cols-[120px_100px_120px_100px_120px_1fr_120px_100px_120px_120px_80px_120px_100px_100px] bg-slate-50/50 border-b border-indigo-50 px-6 py-3 whitespace-nowrap">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">子单编号</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">核销状态</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">手机号</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">归属地</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">集运SKU</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">券码/凭证</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">领取时间</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">使用状态</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">使用时间</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">使用门店</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">是否作废</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">作废时间</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">结算金额</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作</div>
            </div>

            <div className="divide-y divide-slate-100">
              {!loading && filteredOrders.map((order) => {
                const cards = (order.cards && order.cards.length > 0) 
                  ? order.cards 
                  : [{ id: 'LEGACY', cardNo: order.cardNo, cardPwd: order.cardPwd, status: order.status as any }];
                const unitAmount = order.expectedAmount / cards.length;

                return (
                  <div key={order.id} className="group">
                    {/* Order Block Header (Main Info) - Sticky if possible or just repetitive */}
                    <div className="sticky left-0 bg-slate-50/30 px-6 py-4 flex items-center justify-between border-b border-slate-50">
                      <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-lg font-black italic text-indigo-600 shadow-sm">
                            {order.brandName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-800 tracking-tight">{order.brandName}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">面值: ¥{order.faceValue}</div>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="space-y-1">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">订单编号</div>
                          <div className="text-[11px] font-bold text-slate-600 font-mono">#{order.id.toUpperCase()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleAudit(order.id, 'completed')}
                          disabled={order.status === 'completed'}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:grayscale disabled:opacity-50",
                            order.status === 'completed' ? "bg-slate-100 text-slate-400" : "bg-emerald-600 text-white shadow-emerald-100/50 hover:bg-emerald-700"
                          )}
                        >
                          {order.status === 'completed' ? '已收录' : '一键核销'}
                        </button>
                        <button
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
                        >
                          详情
                        </button>
                      </div>
                    </div>

                    {/* Sub-orders Rows */}
                    <div className="divide-y divide-slate-50 bg-white">
                      {cards.map((card, idx) => {
                        const cs = getStatusInfo(card.status);
                        return (
                          <div key={card.id || idx} className="grid grid-cols-[120px_100px_120px_100px_120px_1fr_120px_100px_120px_120px_80px_120px_100px_100px] items-center px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            {/* Sub-order No */}
                            <div className="text-[10px] font-black italic text-slate-400 font-mono">
                              SUB_{order.id.slice(-4).toUpperCase()}_{idx + 1}
                            </div>

                            {/* Verification Status */}
                            <div>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                cs.bg, cs.color.replace('text-', 'border-').replace('600', '200'),
                                cs.color
                              )}>
                                {cs.label}
                              </span>
                            </div>

                            {/* Phone */}
                            <div className="text-[11px] font-bold text-slate-600 font-mono">
                               {card.phone || '-'}
                            </div>

                            {/* Location */}
                            <div className="text-[11px] font-medium text-slate-500">
                               {card.location || '-'}
                            </div>

                            {/* SKU Name */}
                            <div className="text-[11px] font-medium text-slate-500 truncate pr-2">
                               {card.skuName || '-'}
                            </div>

                            {/* Voucher Info */}
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              {card.cardNo && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-black text-slate-300 uppercase">NO:</span>
                                  <span className="text-[10px] font-bold text-slate-600 font-mono truncate">{card.cardNo}</span>
                                </div>
                              )}
                              {card.cardPwd && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-black text-indigo-300 uppercase">PW:</span>
                                  <span className="text-[10px] font-bold text-indigo-600 font-mono truncate">{card.cardPwd}</span>
                                </div>
                              )}
                              {!card.cardNo && !card.cardPwd && (
                                <span className="text-[9px] text-slate-300 italic">空或图片凭证</span>
                              )}
                            </div>

                            {/* Claim Time */}
                            <div className="text-[10px] font-medium text-slate-500 font-mono">
                               {card.claimTime || '-'}
                            </div>

                            {/* Usage Status */}
                            <div className="text-[10px] font-bold">
                               {card.status === 'used' || card.usageTime ? (
                                 <span className="text-emerald-500">已使用</span>
                               ) : (
                                 <span className="text-amber-500">未使用</span>
                               )}
                            </div>

                            {/* Usage Time */}
                            <div className="text-[10px] font-medium text-slate-500 font-mono">
                               {card.usageTime || '-'}
                            </div>

                            {/* Usage Store */}
                            <div className="text-[10px] font-medium text-slate-500 truncate pr-2">
                               {card.usageStore || '-'}
                            </div>

                            {/* Is Invalidated */}
                            <div className="text-[10px] font-bold">
                               {card.isInvalidated ? (
                                 <span className="text-rose-500">是</span>
                               ) : (
                                 <span className="text-slate-300">否</span>
                               )}
                            </div>

                            {/* Invalidated Time */}
                            <div className="text-[10px] font-medium text-slate-500 font-mono">
                               {card.invalidatedTime || '-'}
                            </div>

                            {/* Unit Settlement */}
                            <div>
                              <div className="text-xs font-black text-slate-800 tracking-tighter">¥{unitAmount.toFixed(2)}</div>
                            </div>

                            {/* Individual Actions Placeholder */}
                            <div className="text-right pr-2">
                               <button 
                                onClick={() => navigate(`/admin/orders/${order.id}`)}
                                className="text-[9px] font-black text-indigo-600 hover:underline"
                               >
                                 管理
                               </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">正在同步云端数据...</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-4">
             <div className="h-16 w-16 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200">
                <AlertCircle size={32} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">当前筛选条件下暂无订单</p>
          </div>
        )}
      </div>
    </div>
  );
}
