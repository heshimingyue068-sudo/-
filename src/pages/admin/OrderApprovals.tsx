import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, runTransaction, where, getDoc, serverTimestamp } from 'firebase/firestore';
import { Landmark, Check, X, Search, User, CreditCard, Eye, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CardApprovalItem {
  id: string; // Combined ID: orderId_cardIndex
  orderId: string;
  userId: string;
  cardIndex: number;
  cardNo?: string;
  cardPwd?: string;
  skuName?: string;
  productName?: string;
  phone?: string;
  location?: string;
  claimTime?: string;
  usageTime?: string;
  usageStore?: string;
  isInvalidated?: boolean;
  invalidatedTime?: string;
  amount: number;
  brandName: string;
  createdAt: string;
  realName?: string;
  alipayAccount?: string;
  status: 'pending' | 'settled' | 'rejected';
}

export default function AdminOrderApprovals() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CardApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  
  // Rejection State
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  useEffect(() => {
    fetchOrdersPendingApproval();
  }, []);

  const fetchOrdersPendingApproval = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'), 
        where('pendingSettlement', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      
      const approvalItems: CardApprovalItem[] = [];
      
      for (const orderDoc of snap.docs) {
        const orderData = orderDoc.data();
        const cards = orderData.cards || [];
        
        let userInfo: { realName?: string, alipayAccount?: string } = {};
        try {
          const userSnap = await getDoc(doc(db, 'users', orderData.userId));
          if (userSnap.exists()) {
            userInfo = userSnap.data();
          }
        } catch (e) {
          console.error("Error fetching user:", orderData.userId, e);
        }

        cards.forEach((card: any, idx: number) => {
          if ((card.status === 'settling' || card.status === 'completed') && card.settlementStatus === 'pending') {
            approvalItems.push({
              id: `${orderDoc.id}_${idx}`,
              orderId: orderDoc.id,
              userId: orderData.userId,
              cardIndex: idx,
              cardNo: card.cardNo,
              cardPwd: card.cardPwd,
              skuName: card.skuName || '-',
              productName: card.productName || orderData.brandName,
              phone: card.phone || '-',
              location: card.location || '-',
              claimTime: card.claimTime || '-',
              usageTime: card.usageTime || '-',
              usageStore: card.usageStore || '-',
              isInvalidated: card.isInvalidated,
              invalidatedTime: card.invalidatedTime || '-',
              amount: orderData.expectedAmount / (cards.length || 1),
              brandName: orderData.brandName,
              createdAt: orderData.createdAt,
              realName: userInfo.realName,
              alipayAccount: userInfo.alipayAccount,
              status: 'pending'
            });
          }
        });
      }

      setItems(approvalItems);
    } catch (err) {
      console.error("Error fetching approval items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: CardApprovalItem) => {
    if (!confirm('确定审核通过并结算资金到该用户账户吗？')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', item.orderId);
        const userRef = doc(db, 'users', item.userId);
        
        const orderSnap = await transaction.get(orderRef);
        const userSnap = await transaction.get(userRef);
        
        if (!orderSnap.exists()) throw new Error("订单不存在");
        if (!userSnap.exists()) throw new Error("用户不存在");

        const orderData = orderSnap.data();
        const cards = [...(orderData.cards || [])];
        
        if (cards[item.cardIndex]) {
          cards[item.cardIndex] = {
            ...cards[item.cardIndex],
            status: 'completed',
            settlementStatus: 'settled',
            settledAt: serverTimestamp()
          };
        }

        const stillHasPending = cards.some(c => 
          (c.status === 'settling') || 
          (c.status === 'completed' && c.settlementStatus === 'pending')
        );

        const currentBalance = userSnap.data().balance || 0;
        transaction.update(userRef, {
          balance: currentBalance + item.amount
        });

        transaction.update(orderRef, {
          cards,
          status: stillHasPending ? orderData.status : 'completed',
          pendingSettlement: stillHasPending
        });

        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          userId: item.userId,
          amount: item.amount,
          type: 'income',
          description: `子订单结算: ${item.brandName}-${item.cardIndex + 1}`,
          sourceId: item.orderId,
          cardIndex: item.cardIndex,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      });

      alert('审批通过，资金已实时入账');
      fetchOrdersPendingApproval();
    } catch (err) {
      console.error(err);
      alert('审核失败');
    }
  };

  const handleReject = async (item: CardApprovalItem, reason: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', item.orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("订单不存在");

        const orderData = orderSnap.data();
        const cards = [...(orderData.cards || [])];
        
        if (cards[item.cardIndex]) {
          cards[item.cardIndex] = {
            ...cards[item.cardIndex],
            settlementStatus: 'rejected',
            settlementRejectReason: reason,
            status: 'dispute' 
          };
        }

        const stillHasPending = cards.some(c => 
          (c.status === 'settling') || 
          (c.status === 'completed' && c.settlementStatus === 'pending')
        );

        transaction.update(orderRef, {
          cards,
          status: 'dispute',
          pendingSettlement: stillHasPending
        });
      });

      alert('结算申请已驳回，子订单标记为争议');
      setIsRejectModalOpen(false);
      setRejectReason('');
      setRejectId(null);
      fetchOrdersPendingApproval();
    } catch (err) {
      console.error(err);
      alert('驳回失败');
    }
  };

  const handleGenerateDemo = async () => {
    setLoading(true);
    try {
       const brands = ['星巴克 Starbucks', '瑞幸咖啡 Luckin', '肯德基 KFC', '必胜客 PizzaHut', '麦当劳 McDonald'];
       const skuNames = ['100元代金券', '50元通用券', '30元通用券', '150元电子卡', '50元立减金'];
       
       const demoItems: CardApprovalItem[] = [];
       for (let i = 0; i < 5; i++) {
         demoItems.push({
           id: `demo_${Date.now()}_${i}`,
           orderId: `DEMO_ORD_${i}`,
           userId: `userId_${i}`,
           cardIndex: 0,
           cardNo: `62220000${12345 + i}`,
           cardPwd: `${Math.floor(100000 + Math.random() * 900000)}`,
           skuName: skuNames[i],
           productName: brands[i],
           phone: `13${1 + i}00000000`,
           location: i % 2 === 0 ? '北京' : '广州',
           claimTime: '2024-05-01 10:20',
           usageTime: '2024-05-01 11:45',
           usageStore: i % 3 === 0 ? '朝阳大悦城店' : '天河城店',
           isInvalidated: false,
           invalidatedTime: '-',
           amount: 95.00,
           brandName: brands[i],
           createdAt: new Date().toISOString(),
           realName: `演示用户 ${String.fromCharCode(65 + i)}`,
           alipayAccount: `demo_${i}@alipay.com`,
           status: 'pending'
         });
       }
       setItems(prev => [...prev, ...demoItems]);
       alert('已成功生成 5 条演示审核数据');
    } catch (e) {
       console.error(e);
    } finally {
       setLoading(false);
    }
  };

  const filtered = filterStatus === 'all' 
    ? items 
    : items.filter(i => i.status === filterStatus);

  return (
    <div className="flex-1 space-y-8 p-12 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[1500px]">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">订单审批 (财务总线)</h2>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">已核销子订单的最终资金划分与打款审批</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleGenerateDemo}
            className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all mr-4 shadow-sm"
          >
            + 补充5条演示数据
          </button>

          {['all', 'pending'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                filterStatus === status ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100"
              )}
            >
              {status === 'all' ? '全部项目' : '待处理审批'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
             <div className="min-w-[2000px]">
             {/* Grid Header */}
             <div className="grid grid-cols-[150px_140px_160px_100px_100px_100px_140px_1fr_120px_120px_120px_80px_120px_100px_180px] bg-slate-50/50 border-b border-indigo-50 px-8 py-6 whitespace-nowrap">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">主订单 ID</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">子单编号</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">商品名称</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">核销状态</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">手机号</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">归属地</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">集运SKU</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">券码/凭证 (核销信息)</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">领取时间</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">使用时间</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">使用门店</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">是否作废</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">作废时间</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">结算金额</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作审批</div>
             </div>

             <div className="divide-y divide-slate-50">
               {filtered.map((item) => (
                 <div key={item.id} className="grid grid-cols-[150px_140px_160px_100px_100px_100px_140px_1fr_120px_120px_120px_80px_120px_100px_180px] items-center px-8 py-6 hover:bg-slate-50/50 transition-colors">
                    {/* Main Order ID */}
                    <div className="pr-4">
                      <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter truncate block">{item.orderId}</span>
                    </div>

                    {/* Sub-order No */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-black italic text-slate-400 font-mono">
                        SUB_{item.orderId.slice(-4).toUpperCase()}_{item.cardIndex + 1}
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 uppercase truncate pr-2">{item.brandName}</div>
                    </div>

                    {/* Product Name (Replaced User Info) */}
                    <div className="space-y-1 pr-4">
                      <p className="text-[11px] font-black text-slate-800 line-clamp-2 leading-tight">{item.productName}</p>
                      <p className="text-[9px] font-bold text-indigo-400 uppercase font-mono truncate">{item.realName || '未名'}</p>
                    </div>

                    {/* Verification Status (New/Renamed) */}
                    <div className="text-[10px] font-bold">
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 w-fit">
                         <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                         <span>已核销</span>
                       </div>
                    </div>

                    {/* Phone */}
                    <div className="text-[11px] font-bold text-slate-600 font-mono">
                       {item.phone}
                    </div>

                    {/* Location */}
                    <div className="text-[11px] font-medium text-slate-500">
                       {item.location}
                    </div>

                    {/* SKU Name */}
                    <div className="text-[11px] font-bold text-indigo-600 truncate pr-4">
                       {item.skuName}
                    </div>

                    {/* Voucher Info */}
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {item.cardNo && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black text-slate-300 uppercase">NO:</span>
                          <span className="text-[10px] font-bold text-slate-600 font-mono truncate">{item.cardNo}</span>
                        </div>
                      )}
                      {item.cardPwd && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black text-indigo-300 uppercase">PW:</span>
                          <span className="text-[10px] font-bold text-indigo-600 font-mono truncate">{item.cardPwd}</span>
                        </div>
                      )}
                    </div>

                    {/* Claim Time */}
                    <div className="text-[10px] font-medium text-slate-500 font-mono">
                       {item.claimTime}
                    </div>

                    {/* Usage Time */}
                    <div className="text-[10px] font-medium text-slate-500 font-mono">
                       {item.usageTime}
                    </div>

                    {/* Usage Store */}
                    <div className="text-[10px] font-medium text-slate-500 truncate pr-4">
                       {item.usageStore}
                    </div>

                    {/* Is Invalidated */}
                    <div className="text-[10px] font-bold">
                       {item.isInvalidated ? (
                         <span className="text-rose-500">是</span>
                       ) : (
                         <span className="text-slate-200">否</span>
                       )}
                    </div>

                    {/* Invalidated Time */}
                    <div className="text-[10px] font-medium text-slate-500 font-mono">
                       {item.invalidatedTime}
                    </div>

                    {/* Amount */}
                    <div className="text-sm font-black text-emerald-600 tracking-tighter">
                       ¥{item.amount.toFixed(2)}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pr-2">
                      <button
                        onClick={() => handleApprove(item)}
                        className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center justify-center whitespace-nowrap"
                      >
                         批准
                      </button>

                      <button
                        onClick={() => {
                          setRejectId(item.id);
                          setIsRejectModalOpen(true);
                        }}
                        className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        title="驳回"
                      >
                        <X size={18} />
                      </button>

                      <button
                        onClick={() => navigate(`/admin/orders/${item.orderId}`)}
                        className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                        title="查看原单"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
        
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 grayscale opacity-40">
            <Landmark size={64} className="text-slate-200 mb-6" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">目前没有任何待审批的结算请求</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">拒绝结算申请</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">驳回后订单将进入争议状态，请输入原因</p>
            
            <textarea
              className="w-full h-32 rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm font-bold text-slate-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-50 focus:bg-white transition-all mb-8"
              placeholder="例如：卡密验证失败，请核实原始凭证..."
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
                className="flex-1 rounded-2xl bg-slate-50 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all font-bold"
              >
                取消操作
              </button>
              <button
                onClick={() => {
                  const item = items.find(i => i.id === rejectId);
                  if (item) handleReject(item, rejectReason);
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
