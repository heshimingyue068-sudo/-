import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, cn } from '../../lib/utils';
import { Check, X, AlertCircle } from 'lucide-react';

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
  cards?: any[];
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAudit = async (order: Order, status: 'settling' | 'completed' | 'closed' | 'dispute') => {
    const statusLabels = {
      settling: '结算中',
      completed: '已完成',
      closed: '已关闭',
      dispute: '纠纷中'
    };
    if (!confirm(`确定要将订单标记为 ${statusLabels[status]} 吗？`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);
        const userRef = doc(db, 'users', order.userId);
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("用户不存在");

        transaction.update(orderRef, { 
          status, 
          updatedAt: serverTimestamp() 
        });

        if (status === 'completed') {
          const currentBalance = userDoc.data().balance || 0;
          transaction.update(userRef, { 
            balance: currentBalance + order.expectedAmount 
          });
        }
      });
    } catch (err) {
      console.error(err);
      alert('操作失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'consignment': return '寄售中';
      case 'settling': return '结算中';
      case 'completed': return '已完成';
      case 'closed': return '已关闭';
      case 'dispute': return '纠纷中';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">订单审核</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mt-2">订单审计与验证中心</p>
        </div>
        <div className="flex gap-4">
           <div className="rounded-2xl bg-white px-6 py-3 shadow-xl shadow-slate-200 border border-slate-50">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">寄售中订单</div>
              <div className="text-2xl font-black text-indigo-600 tracking-tighter">
                {orders.filter(o => o.status === 'consignment').length}
              </div>
           </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200 border border-slate-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">序号</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">商品名称</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">订单金额</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">券码数量</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">结算方式</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">创建时间</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">当前状态</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((order, index) => (
                <tr key={order.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-8 py-6 text-[10px] font-black text-slate-400">
                    {(index + 1).toString().padStart(2, '0')}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg font-black italic text-indigo-600 border border-indigo-100">
                        {order.brandName[0]}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 tracking-tight">{order.brandName}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {order.couponType === 'card_password' ? '卡号密文' : '二维码提交'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-800 tracking-tighter">¥{order.faceValue}</div>
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">结算: ¥{order.expectedAmount.toFixed(2)}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-700">
                      {order.cards?.length || 1} <span className="text-[10px] text-slate-300 ml-1">张</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      order.speed === 'fast' ? "text-amber-600" : "text-blue-600"
                    )}>
                      {order.speed === 'fast' ? '极速回款' : '普通结算'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                      {new Date(order.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm",
                      order.status === 'consignment' ? "bg-amber-100 text-amber-700" :
                      order.status === 'settling' ? "bg-blue-100 text-blue-700" :
                      order.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                      order.status === 'closed' ? "bg-slate-100 text-slate-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", 
                        order.status === 'consignment' ? "bg-amber-500" : 
                        order.status === 'settling' ? "bg-blue-500" :
                        order.status === 'completed' ? "bg-emerald-500" : 
                        "bg-slate-500"
                      )} />
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-white text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 border border-slate-100"
                      >
                        详情
                      </button>
                      {order.status === 'consignment' && (
                        <button
                          onClick={() => handleAudit(order, 'settling')}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-[10px] font-black uppercase text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                        >
                          结算
                        </button>
                      )}
                      {(order.status === 'consignment' || order.status === 'settling') && (
                        <button
                          onClick={() => handleAudit(order, 'completed')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-[10px] font-black uppercase text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                        >
                          核销
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
