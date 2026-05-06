import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, writeBatch, where, getDoc } from 'firebase/firestore';
import { Landmark, Check, X, Search, User, CreditCard, Eye } from 'lucide-react';
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

export default function AdminWithdrawals() {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Rejection State
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const withdrawalData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal));
      
      // Enrich data with user profile info to ensure Alipay data is never empty if the user is verified
      const enrichedWithdrawals = await Promise.all(withdrawalData.map(async (w) => {
        if (!w.alipayAccount || !w.realName) {
          try {
            const userSnap = await getDoc(doc(db, 'users', w.userId));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                ...w,
                realName: w.realName || userData.realName || '',
                alipayAccount: w.alipayAccount || userData.alipayAccount || ''
              };
            }
          } catch (e) {
            console.error('Error fetching user info for withdrawal:', w.id, e);
          }
        }
        return w;
      }));

      setWithdrawals(enrichedWithdrawals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (withdrawal: Withdrawal, newStatus: 'processing' | 'completed' | 'rejected', reason?: string) => {
    let confirmMsg = '';
    if (newStatus === 'completed') confirmMsg = '确定标记为已汇款吗？';
    if (newStatus === 'processing') confirmMsg = '确定将该申请标记为打款中吗？';
    if (newStatus === 'rejected') confirmMsg = '确定要驳回该申请吗？';

    if (newStatus !== 'rejected' && !confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);
      
      const updateData: any = { status: newStatus };
      if (reason) updateData.rejectionReason = reason;

      // Clean undefined values if any (though here it's unlikely, it's good practice)
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      // Update withdrawal status
      batch.update(doc(db, 'withdrawals', withdrawal.id), updateData);

      // If rejected, unmark orders and return balance
      if (newStatus === 'rejected') {
        withdrawal.orderIds.forEach(orderId => {
          batch.update(doc(db, 'orders', orderId), { 
            withdrawn: false,
            withdrawId: null 
          });
        });
        
        // Add reversal transaction
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
      fetchWithdrawals();
      setIsRejectModalOpen(false);
      setRejectReason('');
      setRejectId(null);
    } catch (err) {
      console.error(err);
      alert('更新失败');
    }
  };

  const filtered = filterStatus === 'all' 
    ? withdrawals 
    : withdrawals.filter(w => w.status === filterStatus);

  return (
    <div className="flex-1 space-y-8 p-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">提现审批</h2>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">处理用户的打款申请</p>
        </div>
        
        <div className="flex gap-2">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                filterStatus === status ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100"
              )}
            >
              {status === 'all' ? '全部' : 
               status === 'pending' ? '审核中' : 
               status === 'processing' ? '打款中' :
               status === 'completed' ? '已打款' : '已驳回'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">序号</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">创建时间 / 手机号</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">支付宝认证</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">提现金额</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">状态</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((w, idx) => (
              <tr key={w.id} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-8 py-6 text-sm font-black text-slate-300">
                  #{idx + 1}
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-800">{new Date(w.createdAt).toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400">{w.phoneNumber || '138****0000'}</p>
                  </div>
                </td>
                <td className="px-8 py-6">
                  {w.alipayAccount ? (
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-800">{w.realName}</p>
                      <p className="text-[10px] font-bold text-[#00A3FF] uppercase tracking-widest">{w.alipayAccount}</p>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">未认证</span>
                  )}
                </td>
                <td className="px-8 py-6">
                  <span className="text-lg font-black text-indigo-600 tracking-tighter">¥{w.amount.toFixed(2)}</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <span className={cn(
                      "inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest w-fit",
                      w.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                      w.status === 'rejected' ? "bg-rose-50 text-rose-600" : 
                      w.status === 'processing' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {w.status === 'completed' ? '已打款' : 
                       w.status === 'rejected' ? '已驳回' : 
                       w.status === 'processing' ? '打款中' : '审核中'}
                    </span>
                    {w.status === 'rejected' && w.rejectionReason && (
                      <p className="text-[9px] font-bold text-rose-400 truncate max-w-[150px]">原因: {w.rejectionReason}</p>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => navigate(`/admin/withdrawals/${w.id}`)}
                      className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-90"
                      title="查看详情"
                    >
                      <Eye size={18} />
                    </button>

                    {(w.status === 'pending' || w.status === 'processing') && (
                      <>
                        {w.status === 'pending' && (
                          <button
                            onClick={() => handleStatusUpdate(w, 'processing')}
                            className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                            title="标记打款中"
                          >
                            <span className="text-[10px] font-black italic">P</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusUpdate(w, 'completed')}
                          className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                          title="标记已汇款"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setRejectId(w.id);
                            setIsRejectModalOpen(true);
                          }}
                          className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90"
                          title="拒绝申请"
                        >
                          <X size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 grayscale opacity-40">
            <Landmark size={64} className="text-slate-200 mb-6" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无相关提现申请</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">驳回提现申请</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">请输入驳回原因，将通知用户并退回余额</p>
            
            <textarea
              className="w-full h-32 rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm font-bold text-slate-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-50 focus:bg-white transition-all mb-8"
              placeholder="例如：支付宝账户信息有误 / 请填写实名姓名..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason('');
                  setRejectId(null);
                }}
                className="flex-1 rounded-2xl bg-slate-50 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const withdrawal = withdrawals.find(w => w.id === rejectId);
                  if (withdrawal) handleStatusUpdate(withdrawal, 'rejected', rejectReason);
                }}
                disabled={!rejectReason.trim()}
                className="flex-1 rounded-2xl bg-rose-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-rose-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
