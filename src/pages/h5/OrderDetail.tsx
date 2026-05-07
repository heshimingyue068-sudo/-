import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, cn } from '../../lib/utils';
import { 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  ArrowRight,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CardItem {
  id: string;
  cardNo?: string;
  cardPwd?: string;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute' | 'expired' | 'used' | 'invalid';
  settlementStatus?: 'pending' | 'settled' | 'rejected';
}

interface Order {
  id: string;
  brandName: string;
  couponType: string;
  faceValue: number;
  expectedAmount: number;
  status: 'consignment' | 'settling' | 'completed' | 'closed' | 'dispute';
  createdAt: string;
  speed: string;
  cards?: CardItem[];
  // Legacy fields for backward compatibility
  cardNo?: string;
  cardPwd?: string;
  closedReason?: string;
  disputeDetails?: string;
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    async function fetchOrder() {
      if (!id) return;
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Order;
          setOrder({ ...data, id: docSnap.id });
          
          // Initialize countdown if settling
          if (data.status === 'settling') {
            const createdTime = new Date(data.createdAt).getTime();
            const settlingDuration = data.speed === 'fast' ? 10 * 60 * 1000 : 2 * 60 * 60 * 1000; // 10 mins or 2 hours
            const endTime = createdTime + settlingDuration;
            const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeLeft(diff);
          }
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const getStatusConfig = (status: Order['status'] | CardItem['status']) => {
    switch (status) {
      case 'consignment':
        return { label: '寄售中', color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock, desc: '系统正在核验卡券信息，请耐心等待。' };
      case 'settling':
        return { label: '结算中', color: 'text-blue-500', bg: 'bg-blue-50', icon: AlertCircle, desc: '您的卡券已核验通过，款项正在结算中。' };
      case 'completed':
        return { label: '已完成', color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle2, desc: '本单已结算完成，款项已入账。' };
      case 'closed':
        return { label: '已关闭', color: 'text-slate-500', bg: 'bg-slate-100', icon: XCircle, desc: '订单由于审核不通过或其他原因已关闭。' };
      case 'dispute':
        return { label: '纠纷中', color: 'text-rose-500', bg: 'bg-rose-50', icon: HelpCircle, desc: '订单存在疑义，平台正在介入处理。' };
      case 'expired':
        return { label: '已过期', color: 'text-slate-400', bg: 'bg-slate-100', icon: Clock, desc: '卡券已过期，无法继续交易。' };
      case 'used':
        return { label: '已使用', color: 'text-amber-500', bg: 'bg-amber-100', icon: XCircle, desc: '该卡券已被使用，核销失败。' };
      case 'invalid':
        return { label: '已失效', color: 'text-rose-400', bg: 'bg-rose-100', icon: AlertCircle, desc: '卡号或密码有误，卡片失效。' };
      default:
        return { label: '待处理', color: 'text-slate-400', bg: 'bg-slate-50', icon: Clock, desc: '订单正在排队核销中。' };
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fc]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fc] p-6 text-center">
        <div className="rounded-full bg-white p-6 shadow-xl">
           <XCircle size={48} className="text-rose-500" />
        </div>
        <h2 className="text-xl font-black text-slate-800">订单不存在</h2>
        <button onClick={() => navigate('/orders')} className="rounded-full bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all active:scale-95">返回订单列表</button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-6 py-6 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-100 p-2 text-slate-400 hover:bg-slate-50 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">订单详情</h1>
        <div className="w-10"></div>
      </header>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 space-y-6"
      >
        {/* Main Status card removed as per user request */}

        {/* Transaction Summary */}
        <section className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200 border border-slate-50">
           <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-50">
              <div className="flex items-center gap-3">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <span className="text-xl font-black italic">{order.brandName[0]}</span>
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800">{order.brandName}</h3>
                    <p className="text-[10px] font-bold text-slate-400">面值 ¥{order.faceValue}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">我的面值</p>
                 <p className="text-xl font-black text-indigo-600 tracking-tighter">{formatCurrency(order.faceValue)}</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">寄售结算类型</span>
                 <span className="text-xs font-bold text-slate-700">{order.speed === 'fast' ? '极速结算' : '普通结算'}</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">提交时间</span>
                 <span className="text-xs font-bold text-slate-700">{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">预估结算金额</span>
                 <span className="text-lg font-black text-emerald-500 tracking-tighter">{formatCurrency(order.expectedAmount)}</span>
              </div>
           </div>
        </section>

        {/* Card Info */}
        <section className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200 border border-slate-50">
           <div className="mb-6 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-800">寄售明细 (子订单)</h3>
                <p className="text-[10px] font-bold text-slate-400">共计 {order.cards?.length || 0} 张卡券，每张卡券独立核销</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[8px] font-black uppercase text-indigo-600">
                <ShieldCheck size={12} />
                <span>安全核销中</span>
              </div>
           </div>
           
           <div className="space-y-6">
              {order.cards && order.cards.length > 0 ? (
                order.cards.map((card, index) => {
                  const cardStatus = getStatusConfig(card.status);
                  return (
                    <div key={card.id || index} className="relative rounded-3xl border border-slate-50 bg-slate-50/50 p-5 transition-all hover:border-indigo-100 hover:bg-white lg:p-6 group">
                       <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white italic shadow-lg shadow-indigo-200">
                                {index + 1}
                             </div>
                             <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">子订单 #{card.id || (index+1).toString().padStart(4, '0')}</span>
                             </div>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-widest shadow-sm",
                            cardStatus.bg,
                            cardStatus.color
                          )}>
                             <cardStatus.icon size={10} />
                             <span>{cardStatus.label}</span>
                          </div>
                       </div>

                       {cardStatus.label === '已完成' && (
                         <div className="mb-4 flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-50">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">结算环节</span>
                           <div className={cn(
                             "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest",
                             card.settlementStatus === 'settled' ? "bg-emerald-50 text-emerald-600" :
                             card.settlementStatus === 'rejected' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                           )}>
                             {card.settlementStatus === 'settled' ? '资金已入账' : 
                              card.settlementStatus === 'rejected' ? '结算被驳回' : '等待财务审批'}
                           </div>
                         </div>
                       )}

                       <div className="grid gap-3">
                          {card.cardNo && (
                            <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-50">
                               <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">卡号</span>
                                  <span className="text-sm font-bold text-slate-700 font-mono tracking-wider break-all">{card.cardNo}</span>
                               </div>
                               <button onClick={() => copyToClipboard(card.cardNo!)} className="text-indigo-300 hover:text-indigo-600">
                                  <Copy size={16} />
                                </button>
                            </div>
                          )}
                          {card.cardPwd && (
                            <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-50">
                               <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">卡密</span>
                                  <span className="text-sm font-bold text-slate-700 font-mono tracking-wider break-all">{card.cardPwd}</span>
                               </div>
                               <button onClick={() => copyToClipboard(card.cardPwd!)} className="text-indigo-300 hover:text-indigo-600">
                                  <Copy size={16} />
                               </button>
                            </div>
                          )}
                       </div>

                       {/* Status Remarks */}
                       <div className="mt-4 rounded-2xl bg-white/50 p-4 border border-slate-100/50">
                          <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                             <HelpCircle size={12} />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">状态备注</span>
                          </div>
                          <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                             {cardStatus.desc}
                          </p>
                       </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                   <Clock className="mb-2 opacity-20" size={32} />
                   <p className="text-[10px] font-bold uppercase tracking-widest">暂无详细卡券数据</p>
                </div>
              )}
           </div>
        </section>
      </motion.main>
    </div>
  );
}
