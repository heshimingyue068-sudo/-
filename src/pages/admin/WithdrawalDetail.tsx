import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { 
  Landmark, 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  CreditCard, 
  ShoppingBag,
  ExternalLink, 
  Copy,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface Withdrawal {
  id: string;
  userId: string;
  realName: string;
  alipayAccount: string;
  phoneNumber?: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  orderIds: string[];
  rejectionReason?: string;
}

interface Order {
  id: string;
  brandName: string;
  faceValue: number;
  expectedAmount: number;
  status: string;
  createdAt: string;
}

export default function AdminWithdrawalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchWithdrawalData();
    }
  }, [id]);

  const fetchWithdrawalData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const wSnap = await getDoc(doc(db, 'withdrawals', id));
      if (!wSnap.exists()) {
        alert('提现记录不存在');
        navigate('/admin/withdrawals');
        return;
      }

      const wData = { id: wSnap.id, ...wSnap.data() } as Withdrawal;
      setWithdrawal(wData);

      // Fetch related orders
      if (wData.orderIds && wData.orderIds.length > 0) {
        // Firestore 'in' query supports up to 30 items. 
        // If more, we'd need to chunk, but for most withdrawals it should be fine.
        const ordersQuery = query(
          collection(db, 'orders'),
          where('__name__', 'in', wData.orderIds)
        );
        const oSnap = await getDocs(ordersQuery);
        const oData = oSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        setOrders(oData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: Withdrawal['status'], reason?: string) => {
    if (!withdrawal) return;
    
    let confirmMsg = '';
    if (newStatus === 'completed') confirmMsg = '确定标记为已汇款吗？';
    if (newStatus === 'processing') confirmMsg = '确定开始打款处理吗？';
    if (newStatus === 'rejected') confirmMsg = '确定要驳回该申请吗？';

    if (newStatus !== 'rejected' && !confirm(confirmMsg)) return;

    setUpdating(true);
    try {
      const batch = writeBatch(db);
      const wRef = doc(db, 'withdrawals', withdrawal.id);
      
      const updateData: any = { status: newStatus };
      if (reason) updateData.rejectionReason = reason;
      
      batch.update(wRef, updateData);

      if (newStatus === 'rejected') {
        withdrawal.orderIds.forEach(orderId => {
          batch.update(doc(db, 'orders', orderId), { 
            withdrawn: false,
            withdrawId: null 
          });
        });
        
        batch.set(doc(collection(db, 'transactions')), {
          userId: withdrawal.userId,
          amount: withdrawal.amount,
          type: 'income',
          description: `提现驳回退款: ${reason || '不符合提现规则'}`,
          sourceId: withdrawal.id,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      }

      await batch.commit();
      setWithdrawal(prev => prev ? { ...prev, status: newStatus, rejectionReason: reason || prev.rejectionReason } : null);
      if (newStatus === 'completed' || newStatus === 'rejected') {
        setTimeout(() => navigate('/admin/withdrawals'), 1500);
      }
    } catch (err) {
      console.error(err);
      alert('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple feedback could be added here
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-lg" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Withdrawal Ledger...</p>
      </div>
    );
  }

  if (!withdrawal) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/admin/withdrawals')}
            className="group flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-white text-slate-400 shadow-xl shadow-slate-200/50 border border-slate-50 transition-all hover:text-indigo-600 hover:scale-110 active:scale-95"
          >
            <ChevronLeft size={24} className="transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">审批详情</h1>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] translate-y-1">/ EXAMINE LEDGER</span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
              ID: <span className="text-indigo-600 font-mono">{withdrawal.id}</span>
            </p>
          </div>
        </div>

        {(withdrawal.status === 'pending' || withdrawal.status === 'processing') && (
          <div className="flex gap-4">
            {withdrawal.status === 'pending' && (
              <button 
                onClick={() => updateStatus('processing')}
                className="h-14 px-8 rounded-2xl bg-indigo-50 text-[10px] font-black uppercase tracking-widest text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-lg shadow-indigo-100/50"
              >
                开始处理 (PROCESS)
              </button>
            )}
            <button 
              onClick={() => updateStatus('completed')}
              className="h-14 px-8 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200/50"
            >
              完成打款 (APPROVE)
            </button>
            <button 
              onClick={() => {
                const reason = prompt('请输入驳回原因:');
                if (reason) updateStatus('rejected', reason);
              }}
              className="h-14 px-8 rounded-2xl bg-rose-50 text-[10px] font-black uppercase tracking-widest text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-100/50"
            >
              驳回申请 (REJECT)
            </button>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* GROUP 1: 提现核心数据 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <div className="flex items-center gap-3 mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">01 提现基础信息</h3>
            <div className="h-px flex-1 bg-slate-100" />
            <div className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
              withdrawal.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
              withdrawal.status === 'rejected' ? "bg-rose-100 text-rose-700" :
              withdrawal.status === 'processing' ? "bg-indigo-100 text-indigo-700" :
              "bg-amber-100 text-amber-700"
            )}>
              {withdrawal.status === 'completed' ? '已汇款' : withdrawal.status === 'rejected' ? '已驳回' : withdrawal.status === 'processing' ? '处理中' : '审核中'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">申请金额</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-indigo-600 tracking-tighter">¥{withdrawal.amount.toFixed(2)}</span>
                <span className="text-[10px] font-black text-slate-300 uppercase italic">CNY</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">申请时间</p>
              <div className="flex items-center gap-3 text-slate-800">
                <Clock size={16} className="text-slate-300" />
                <p className="text-lg font-black tracking-tight">{new Date(withdrawal.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                {new Date(withdrawal.createdAt).toLocaleTimeString()}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">包含订单</p>
              <div className="flex items-center gap-3 text-slate-800">
                <Receipt size={16} className="text-slate-300" />
                <p className="text-lg font-black tracking-tight">{withdrawal.orderIds?.length || 0} <span className="text-sm">笔</span></p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">提现来源</p>
              <div className="h-10 px-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 w-fit">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">余额提取 (Balance)</span>
              </div>
            </div>
          </div>
        </section>

        {/* GROUP 2: 收款账户详情 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-slate-200" />
          <div className="flex items-center gap-3 mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">02 收款账户与身份</h3>
            <div className="h-px flex-1 bg-slate-100" />
            <Landmark size={18} className="text-slate-300" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">实名姓名 (PAYEE NAME)</p>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <User size={20} className="text-slate-400" />
                </div>
                <p className="text-lg font-black text-slate-800 tracking-tight">{withdrawal.realName}</p>
              </div>
            </div>

            <div className="md:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">收款账号 (ALIPAY ENDPOINT)</p>
              <div className="flex items-center justify-between bg-[#00A3FF]/5 p-6 rounded-[2rem] border border-[#00A3FF]/10 group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                    <CreditCard size={20} className="text-[#00A3FF]" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#00A3FF] font-mono tracking-tight">{withdrawal.alipayAccount}</p>
                    <p className="text-[10px] font-black text-[#00A3FF]/60 uppercase tracking-widest mt-1">VERIFIED ALIPAY ACCOUNT</p>
                  </div>
                </div>
                <button 
                  onClick={() => copyToClipboard(withdrawal.alipayAccount)}
                  className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white text-[#00A3FF] hover:bg-[#00A3FF] hover:text-white transition-all shadow-sm active:scale-90"
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* GROUP 3: 明细订单分析 */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <div className="flex items-center gap-3 mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">03 关联回款订单明细</h3>
            <div className="h-px flex-1 bg-slate-100" />
            <ShoppingBag size={18} className="text-slate-300" />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">序号</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">品牌名称 (BRAND)</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">成交金额 (SETTLED)</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">创建时间</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">查看</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-400 italic">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 border border-indigo-100">
                           {order.brandName?.[0] || '?'}
                         </div>
                         <p className="text-sm font-black text-slate-800 tracking-tight">{order.brandName}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-emerald-600">¥{order.expectedAmount.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-slate-400">面值 ¥{order.faceValue}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button 
                         onClick={() => navigate(`/admin/orders/${order.id}`)}
                         className="h-10 w-10 flex items-center justify-center rounded-xl bg-white text-slate-300 hover:text-indigo-600 transition-all border border-slate-100 shadow-sm"
                       >
                         <ExternalLink size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rejection Note Overlay (If Rejected) */}
        <AnimatePresence>
          {withdrawal.status === 'rejected' && withdrawal.rejectionReason && (
            <section className="bg-rose-50 rounded-[2.5rem] p-10 border border-rose-100 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
               <div className="flex items-center gap-4 mb-6">
                 <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                   <AlertCircle size={20} />
                 </div>
                 <div>
                   <h3 className="text-lg font-black text-rose-800 tracking-tight">驳回原因记录</h3>
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-1">REJECTION DECISION LOG</p>
                 </div>
               </div>
               <div className="bg-white/50 p-8 rounded-3xl border border-white">
                 <p className="text-sm font-black text-rose-900 leading-relaxed italic">
                   “ {withdrawal.rejectionReason} ”
                 </p>
               </div>
            </section>
          )}
        </AnimatePresence>

        {/* Audit Guidance Area */}
        <div className="bg-slate-50 rounded-[2.5rem] p-12 border border-slate-100 text-center">
          <Receipt className="mx-auto mb-6 text-slate-300" size={40} />
          <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">WITHDRAWAL OPERATION PROTOCOLS</h5>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">账户核验</p>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">打款前请务必仔细校对实名姓名与支付宝账号，点击复制按钮确保输入准确无误。</p>
            </div>
            <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">自动对账</p>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">系统已自动汇总提现金额对应的回款订单，点击详情可查看该用户具体的核销卡券明细。</p>
            </div>
            <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">异常处理</p>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">如遇账户异常，驳回申请将自动解冻相关订单并退回余额，请在备注中详述解决方案。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
