import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { 
  ChevronLeft, 
  Zap, 
  Clock, 
  Upload, 
  CheckCircle, 
  Plus, 
  FileText, 
  Trash2, 
  Hash, 
  Scan,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Brand {
  id: string;
  name: string;
  logo: string;
  supportTypes: string[];
}

interface CouponConfig {
  id: string;
  faceValue: number;
  fastRate: number;
  slowRate: number;
}

export default function BrandDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [configs, setConfigs] = useState<CouponConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<CouponConfig | null>(null);
  const [speed, setSpeed] = useState<'fast' | 'slow'>('fast');
  
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single');
  const [batchText, setBatchText] = useState('');
  const [cards, setCards] = useState([{ no: '', pwd: '', expiry: '' }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const brandDoc = await getDoc(doc(db, 'brands', id));
        if (brandDoc.exists()) {
          const brandData = { id: brandDoc.id, ...brandDoc.data() } as Brand;
          setBrand(brandData);
          setSelectedType(brandData.supportTypes[0] || '');
        }

        const configSnap = await getDocs(query(collection(db, 'configs'), where('brandId', '==', id), where('isActive', '==', true)));
        setConfigs(configSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CouponConfig)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const addCard = () => setCards([...cards, { no: '', pwd: '', expiry: '' }]);
  const removeCard = (index: number) => setCards(cards.filter((_, i) => i !== index));
  const updateCard = (index: number, field: 'no' | 'pwd' | 'expiry', value: string) => {
    const newCards = [...cards];
    newCards[index][field] = value;
    setCards(newCards);
  };

  const handleSubmit = async () => {
    if (!user || !brand || !selectedConfig) return;
    
    if (selectedType === 'card_password') {
      let finalCards = [];

      if (inputMode === 'single') {
        const validCards = cards.filter(c => c.pwd); // Now only require pwd as per new prompt
        if (validCards.length === 0) {
          alert('请至少填写一个卡密');
          return;
        }
        finalCards = validCards.map(c => ({
          cardNo: c.no || '',
          cardPwd: c.pwd,
          expiryDate: c.expiry
        }));
      } else {
        // Batch parsing: pwd@expiry
        if (!batchText.trim()) {
          alert('请输入批量内容');
          return;
        }
        const lines = batchText.split(/\r?\n/).filter(line => line.trim());
        finalCards = lines.map(line => {
          const [pwd, expiry] = line.split('@');
          return {
            cardNo: '',
            cardPwd: pwd?.trim() || '',
            expiryDate: expiry?.trim() || ''
          };
        }).filter(c => c.cardPwd);

        if (finalCards.length === 0) {
          alert('未能解析到有效的卡密内容，请检查格式');
          return;
        }
      }

      setSubmitting(true);
      try {
        const rate = speed === 'fast' ? selectedConfig.fastRate : selectedConfig.slowRate;
        const batch = [];
        
        for (const card of finalCards) {
          batch.push(addDoc(collection(db, 'orders'), {
            userId: user.uid,
            brandId: brand.id,
            brandName: brand.name,
            couponType: selectedType,
            speed,
            faceValue: selectedConfig.faceValue,
            expectedAmount: selectedConfig.faceValue * rate,
            cardNo: card.cardNo,
            cardPwd: card.cardPwd,
            expiryDate: card.expiryDate,
            status: 'consignment',
            createdAt: new Date().toISOString(),
          }));
        }
        
        await Promise.all(batch);
        navigate('/orders');
      } catch (err) {
        console.error(err);
        alert('提交失败，请重试');
      } finally {
        setSubmitting(false);
      }
    } else {
      // QR code logic
      alert('暂不支持该类型的批量处理，请联系客服');
    }
  };

  const getSelectedCardCount = () => {
    if (selectedType !== 'card_password') return 0;
    if (inputMode === 'single') {
      return cards.filter(c => c.pwd).length;
    }
    return batchText.split(/\r?\n/).filter(line => line.trim().split('@')[0]).length;
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!brand) return <div className="p-4">品牌不存在</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-white px-6 py-4 shadow-sm border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-indigo-600 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center text-lg font-black text-slate-800 tracking-tight uppercase">{brand.name} 寄售</h1>
        <div className="w-6"></div>
      </div>

      <div className="flex-1 p-6 space-y-8 pb-56">
        {/* Steps */}
        <div className="flex justify-between items-center mb-8 px-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-200">1</div>
            <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600">选择品牌</span>
          </div>
          <div className="h-[2px] bg-indigo-100 flex-1 mx-4"></div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-200">2</div>
            <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600">填写详情</span>
          </div>
          <div className="h-[2px] bg-indigo-100 flex-1 mx-4"></div>
          <div className="flex flex-col items-center gap-1 opacity-40">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-black">3</div>
            <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">提交审核</span>
          </div>
        </div>

        {/* Brand Info */}
        <div className="flex items-center gap-4 rounded-[2rem] bg-indigo-50 p-5 border border-indigo-100 shadow-inner">
          <div className="h-16 w-16 rounded-2xl bg-white p-2 shadow-sm border border-indigo-50 flex items-center justify-center">
            <img src={brand.logo} alt={brand.name} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">{brand.name}</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">礼品卡及卡券寄售</p>
          </div>
        </div>

        {/* Face Values Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">选择单张面值</h3>
            {selectedConfig && (
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">已选 ¥{selectedConfig.faceValue}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {configs.map((config) => (
              <button
                key={config.id}
                onClick={() => setSelectedConfig(config)}
                className={cn(
                  "group relative overflow-hidden rounded-[1.5rem] border-2 py-5 text-center transition-all active:scale-95",
                  selectedConfig?.id === config.id 
                    ? "border-indigo-600 bg-white shadow-2xl shadow-indigo-100" 
                    : "border-transparent bg-white shadow-xl shadow-slate-100 hover:border-indigo-100"
                )}
              >
                <div className={cn(
                  "text-xl font-black tracking-tighter transition-colors",
                  selectedConfig?.id === config.id ? "text-indigo-600" : "text-slate-800"
                )}>
                  ¥{config.faceValue}
                </div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                  {speed === 'fast' ? (config.fastRate * 100).toFixed(0) : (config.slowRate * 100).toFixed(0)}% 折扣
                </div>
                {selectedConfig?.id === config.id && (
                  <div className="absolute -top-1 -right-1">
                    <div className="bg-indigo-600 text-white p-1 rounded-bl-xl shadow-lg">
                      <CheckCircle size={10} />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Consignment Speed Selection */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">寄售结算速度</h3>
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
              <AlertCircle size={12} />
              <span>慢收价格更高</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { type: 'fast', label: '极速结算', time: '1分钟内到账', icon: Zap },
              { type: 'slow', label: '普通结算', time: '24小时内到账', icon: Clock },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => setSpeed(opt.type as any)}
                className={cn(
                  "group relative overflow-hidden rounded-[2rem] border-2 p-5 text-left transition-all active:scale-95",
                  speed === opt.type 
                    ? "border-indigo-600 bg-white shadow-2xl shadow-indigo-100" 
                    : "border-transparent bg-white shadow-xl shadow-slate-100"
                )}
              >
                <div className={cn(
                  "mb-4 flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
                  speed === opt.type ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400"
                )}>
                  <opt.icon size={20} />
                </div>
                <div>
                   <p className={cn("text-[10px] font-black uppercase tracking-widest mb-0.5", speed === opt.type ? "text-indigo-600" : "text-slate-400")}>
                    {opt.label}
                  </p>
                  <div className="text-xl font-black text-slate-800 tracking-tighter">
                    {selectedConfig 
                      ? `¥${(selectedConfig.faceValue * (opt.type === 'fast' ? selectedConfig.fastRate : selectedConfig.slowRate)).toFixed(1)}` 
                      : '---'}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{opt.time}</p>
                </div>
                {speed === opt.type && (
                  <div className="absolute -top-1 -right-1 bg-indigo-600 text-white p-1 rounded-bl-xl">
                    <CheckCircle size={10} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Consignment Type Slider */}
        <section>
          <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">选择寄售类型</h3>
          <div className="flex p-1.5 bg-slate-200/50 rounded-[1.5rem] backdrop-blur-sm">
            {brand.supportTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedType === type 
                    ? "bg-white text-indigo-600 shadow-xl shadow-indigo-100/50" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {type === 'card_password' ? <Hash size={14} /> : <Scan size={14} />}
                {type === 'card_password' ? '卡密' : '二维码'}
              </button>
            ))}
          </div>
        </section>

        {/* Form Inputs */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {selectedType === 'card_password' ? '填写卡密信息' : '上传凭证'}
            </h3>
            {selectedType === 'card_password' && inputMode === 'single' && (
              <button onClick={addCard} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-100 transition-colors">
                <Plus size={12} />
                <span>继续添加</span>
              </button>
            )}
          </div>
          
          {selectedType === 'card_password' ? (
            <div className="space-y-6">
              {/* Input Mode Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setInputMode('single')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    inputMode === 'single' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  单张
                </button>
                <button
                  onClick={() => setInputMode('batch')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    inputMode === 'batch' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  批量
                </button>
              </div>

              {inputMode === 'single' ? (
                <div className="space-y-6">
                  {cards.map((card, idx) => (
                    <div key={idx} className="relative space-y-4 p-6 rounded-[2.5rem] bg-white shadow-2xl shadow-slate-100 border border-slate-50 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-black text-white">
                            {idx + 1}
                          </div>
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">单张详情</span>
                        </div>
                        {cards.length > 1 && (
                          <button 
                            onClick={() => removeCard(idx)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                            <Zap size={16} />
                          </div>
                          <input
                            type="text"
                            placeholder="请输入卡密 Password"
                            className="w-full rounded-2xl bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold outline-none border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-300"
                            value={card.pwd}
                            onChange={(e) => updateCard(idx, 'pwd', e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                            <Calendar size={16} />
                          </div>
                          <input
                            type="text"
                            placeholder="有效期 (如: 2025-12-31)"
                            className="w-full rounded-2xl bg-slate-50 pl-11 pr-4 py-4 text-sm font-bold outline-none border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-300"
                            value={card.expiry}
                            onChange={(e) => updateCard(idx, 'expiry', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      placeholder="请按照格式输入：卡密@有效期"
                      className="w-full min-h-[200px] rounded-[2rem] bg-white p-6 text-sm font-bold outline-none border-2 border-slate-100 focus:border-indigo-600 transition-all shadow-xl shadow-slate-100 placeholder:text-slate-300 resize-none"
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4 bg-slate-50 px-3 py-1 rounded-full text-[8px] font-black text-slate-400">
                      BATCH MODE
                    </div>
                  </div>
                  <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100/50">
                    <p className="text-[10px] font-black text-amber-600/80 leading-relaxed">
                      1.每行格式为:卡密@有效期(有效期格式yyyy-mm-dd,例子:2019-07-26)<br/>
                      2.每行使用换行符(回车)间隔
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-indigo-600 hover:text-indigo-600 transition-all group cursor-pointer shadow-xl shadow-slate-100">
              <div className="mb-4 rounded-3xl bg-indigo-50 p-6 text-indigo-600 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-100">
                <Upload size={40} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">点击上传二维码</span>
              <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                Clear photo for 1-minute speedy audit
              </p>
            </div>
          )}
        </section>

        {/* Instructions */}
        <section className="rounded-2xl border border-blue-50 bg-indigo-50/30 p-5">
          <h4 className="mb-2 text-[10px] font-black uppercase tracking-wider text-indigo-700">寄售说明</h4>
          <ul className="space-y-1 text-[9px] font-bold text-indigo-600/80 uppercase tracking-tight">
            <li>• 请确认卡号、卡密准确无误，填写错误将导致无法核销。</li>
            <li>• 提交后请耐心等待系统或人工审核结算（5-30分钟）。</li>
            <li>• 违规寄售（如已核销卡、假卡）将面临账号封禁风险。</li>
          </ul>
        </section>
      </div>

      {/* Footer Submit */}
      <div className="fixed bottom-[96px] left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-6">
        <div className="w-full rounded-[2rem] bg-white/95 p-5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.15)] backdrop-blur-xl border border-slate-100">
          <div className="mb-4 flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">预估结算:</span>
              <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tight">
                已选 {getSelectedCardCount()} 张卡
              </span>
            </div>
            <span className="text-2xl font-black text-indigo-600 tracking-tighter">
              {selectedConfig 
                ? formatCurrency(selectedConfig.faceValue * (speed === 'fast' ? selectedConfig.fastRate : selectedConfig.slowRate) * getSelectedCardCount()) 
                : '¥0.00'}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedConfig || getSelectedCardCount() === 0}
            className="w-full rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:grayscale disabled:opacity-50"
          >
            {submitting ? '正在提交...' : `确认寄售 ${getSelectedCardCount()} 张卡`}
          </button>
        </div>
      </div>
    </div>
  );
}
