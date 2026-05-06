import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { formatCurrency, cn } from '../../lib/utils';
import { Clock, CheckCircle2, XCircle, AlertCircle, Database } from 'lucide-react';

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
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute';
  createdAt: string;
  speed: string;
  cards?: CardItem[];
  // Legacy fields
  cardNo?: string;
  cardPwd?: string;
  closedReason?: string;
  disputeDetails?: string;
}

export default function OrderList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  const tabs = [
    { id: 'all', label: '全部' },
    { id: 'consignment', label: '寄售中' },
    { id: 'settling', label: '结算中' },
    { id: 'completed', label: '已完成' },
    { id: 'closed', label: '已关闭' },
    { id: 'dispute', label: '纠纷中' },
  ];

  const seedData = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    const statuses: Order['status'][] = ['consignment', 'settling', 'completed', 'closed', 'dispute'];
    const brands = ['京东E卡', '天猫超市卡', '中石化油卡', '星巴克礼品卡', '腾讯视频VIP'];
    
    try {
      for (const status of statuses) {
        for (let i = 0; i < 3; i++) {
          const faceValue = [50, 100, 200, 500][Math.floor(Math.random() * 4)];
          const rate = 0.92 + (Math.random() * 0.05);
          
          const cardNumber = Math.floor(Math.random() * 5) + 1; // 1-5 cards per order
          const cards = Array(cardNumber).fill(0).map(() => {
            const cardStatus = (Math.random() > 0.3) ? status : statuses[Math.floor(Math.random() * statuses.length)];
            return {
              id: Math.random().toString(36).substring(2, 9).toUpperCase(),
              cardNo: 'JD' + Math.random().toString(36).substring(2, 12).toUpperCase(),
              cardPwd: Math.random().toString(36).substring(2, 10).toUpperCase(),
              status: cardStatus
            };
          });

          const totalFaceValue = faceValue * cardNumber;
          const totalExpectedAmount = Math.floor(totalFaceValue * rate);

          const orderData: any = {
            userId: user.uid,
            brandName: brands[Math.floor(Math.random() * brands.length)],
            couponType: 'card_password',
            faceValue: totalFaceValue,
            expectedAmount: totalExpectedAmount,
            status,
            speed: Math.random() > 0.5 ? 'fast' : 'slow',
            createdAt: new Date(Date.now() - Math.random() * 1000000).toISOString(),
            updatedAt: new Date().toISOString(),
            cards: cards
          };

          if (status === 'closed') {
            orderData.closedReason = '卡号或卡密错误，验证码核销失败。';
          } else if (status === 'dispute') {
            orderData.disputeDetails = '卖家反馈卡片已被激活，需提供卡片原始购买凭证进行申诉。';
          }

          await addDoc(collection(db, 'orders'), orderData);
        }
      }
      alert('已成功增加15个测试订单（每种状态3个）');
    } catch (error) {
      console.error("Seed error:", error);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersList);
      setLoading(false);
    }, (error) => {
      console.error("Order fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredOrders = activeTab === 'all' 
    ? orders 
    : orders.filter(o => {
        if (o.status === activeTab) return true;
        // Also show if any sub-order matches the status
        return o.cards?.some(c => c.status === activeTab);
      });

  const getStatusInfo = (status: Order['status'] | CardItem['status']) => {
    switch (status) {
      case 'consignment':
        return { label: '寄售中', color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock };
      case 'settling':
        return { label: '结算中', color: 'text-blue-500', bg: 'bg-blue-50', icon: AlertCircle };
      case 'completed':
        return { label: '已完成', color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle2 };
      case 'closed':
        return { label: '已关闭', color: 'text-slate-500', bg: 'bg-slate-50', icon: XCircle };
      case 'dispute':
        return { label: '纠纷中', color: 'text-rose-500', bg: 'bg-rose-50', icon: AlertCircle };
      case 'expired':
        return { label: '已过期', color: 'text-slate-400', bg: 'bg-slate-100', icon: Clock };
      case 'used':
        return { label: '已使用', color: 'text-amber-500', bg: 'bg-amber-100', icon: XCircle };
      case 'invalid':
        return { label: '已失效', color: 'text-rose-400', bg: 'bg-rose-100', icon: AlertCircle };
      default:
        return { label: '待处理', color: 'text-slate-400', bg: 'bg-slate-50', icon: Clock };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      <div className="sticky top-0 z-20 bg-white px-6 pt-6 pb-2 border-b border-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">我的订单</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">ORDER HISTORY</p>
          </div>
          <button 
            onClick={seedData}
            disabled={seeding}
            className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          >
            <Database size={14} />
            {seeding ? '同步中...' : '生成测试数据'}
          </button>
        </div>
        
        {/* Scrollable Tabs */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105" 
                  : "bg-slate-50 text-slate-400 border border-transparent"
              )}
            >
              {tab.label}
              <span className="ml-1.5 opacity-50">
                {tab.id === 'all' 
                  ? orders.length 
                  : orders.filter(o => o.status === tab.id || o.cards?.some(c => c.status === tab.id)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 pb-24 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-40 w-full animate-pulse rounded-[2.5rem] bg-white shadow-xl shadow-slate-200"></div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
            <div className="mb-6 rounded-[2rem] bg-white p-8 shadow-2xl shadow-slate-200">
              <Clock size={48} className="opacity-10 text-indigo-600" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">暂无相关订单</p>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">开始您的第一笔寄售吧</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              return (
                <div 
                  key={order.id} 
                  onClick={() => navigate(`/order/${order.id}`)}
                  className="group relative overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-xl shadow-slate-200 border border-slate-50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100">
                        <span className="text-xl font-black italic text-indigo-600">{order.brandName[0]}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h3 className="font-black text-slate-800">{order.brandName}</h3>
                        </div>
                        <div className="flex gap-2 items-center mt-0.5">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                            共 {order.cards?.length || 1} 份子订单
                          </span>
                          <div className="h-1 w-1 rounded-full bg-slate-200"></div>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest",
                            order.speed === 'fast' ? "text-indigo-600" : "text-emerald-500"
                          )}>
                            {order.speed === 'fast' ? '极速结算' : '普通结算'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Status badge removed as per user request */}
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100/50">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">总计结算 (预估)</p>
                      <p className="text-2xl font-black text-indigo-600 tracking-tighter">
                        {formatCurrency(order.expectedAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">主订单 ID / 总面值</p>
                      <p className="text-[10px] font-bold text-slate-600 mt-1">
                        ¥{order.faceValue}
                      </p>
                      <p className="text-[8px] font-medium text-slate-300 truncate w-24 tracking-tighter uppercase whitespace-nowrap">ID: {order.id.slice(-8)}</p>
                    </div>
                  </div>

                  {/* Sub-orders Detailed List at Bottom */}
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
                    <div className="mb-2 flex items-center justify-between px-1">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">子订单明细</span>
                       <span className="text-[9px] font-bold text-slate-400">共 {order.cards?.length || 1} 份</span>
                    </div>
                    {(order.cards && order.cards.length > 0 ? order.cards : [{ id: order.id.slice(-6), cardNo: order.cardNo, cardPwd: order.cardPwd, status: order.status as any }]).slice(0, 3).map((card, idx) => {
                      const cardStatus = getStatusInfo(card.status);
                      const subExpectedAmount = order.cards?.length ? order.expectedAmount / order.cards.length : order.expectedAmount;
                      
                      return (
                        <div key={card.id || idx} className="rounded-2xl border border-slate-50 bg-slate-50/30 p-3 transition-colors hover:bg-white group/item">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black italic text-indigo-300">#{idx + 1}</span>
                              <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">编号: {card.id || `SUB-${idx+1}`}</span>
                            </div>
                            <div className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm", cardStatus.bg, cardStatus.color)}>
                              {cardStatus.label}
                            </div>
                          </div>
                          
                          <div className="flex items-end justify-between">
                            <div className="space-y-1">
                              {card.cardPwd && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-black uppercase text-slate-300">卡密:</span>
                                  <span className="text-[10px] font-bold text-slate-600 font-mono tracking-wider">{card.cardPwd.slice(0, 4)}****{card.cardPwd.slice(-4)}</span>
                                </div>
                              )}
                              {card.cardNo && (
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="text-[8px] font-black uppercase">卡号:</span>
                                  <span className="text-[9px] font-medium font-mono">{card.cardNo.slice(0, 4)}...{card.cardNo.slice(-4)}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="block text-[8px] font-black uppercase text-slate-300 leading-none mb-0.5">预计结算</span>
                              <span className="text-sm font-black text-indigo-500">{formatCurrency(subExpectedAmount)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {order.cards && order.cards.length > 3 && (
                      <div className="py-1 text-center">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest animate-pulse mt-1">
                          + 还有 {order.cards.length - 3} 份子订单待核销
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between px-1">
                     <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">{new Date(order.createdAt).toLocaleString()}</p>
                     <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-indigo-400">
                       <span>全部明细</span>
                       <div className="h-4 w-4 bg-indigo-50 shadow-sm flex items-center justify-center rounded-full leading-none group-hover:translate-x-1 transition-transform">→</div>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
