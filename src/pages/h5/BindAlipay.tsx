import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ChevronLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function BindAlipay() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const [realName, setRealName] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAuthorize = () => {
    setAuthorizing(true);
    // Simulate Alipay authorization
    setTimeout(() => {
      setAuthorizing(false);
      setAuthorized(true);
    }, 1500);
  };

  const handleConfirm = async () => {
    if (!realName || !authorized || !updateProfile) return;
    setSubmitting(true);
    try {
      await updateProfile({
        realName,
        alipayAccount: 'ALIPAY_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      });
      alert('支付宝绑定成功');
      navigate('/profile');
    } catch (error) {
      console.error(error);
      alert('绑定失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-6 py-6 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-100 p-2 text-slate-400">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">绑定支付宝</h1>
        <div className="w-10"></div>
      </header>

      <main className="p-6 space-y-8">
        <section className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200 border border-slate-50">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
               <ShieldCheck size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-800">账户安全验证</h2>
            <p className="mt-2 text-xs font-bold text-slate-400">为了您的资金安全，请先完成身份验证及支付宝绑定</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">真实姓名</label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="请输入实名认证姓名"
                className="w-full rounded-2xl bg-slate-50 px-6 py-4 text-sm font-bold text-slate-800 border border-slate-100 outline-none focus:border-indigo-600 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">支付宝授权</label>
                {authorized && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    <CheckCircle2 size={12} />
                    已授权成功
                  </span>
                )}
              </div>
              
              <button
                onClick={handleAuthorize}
                disabled={authorizing || authorized}
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-2xl py-4 transition-all active:scale-[0.98]",
                  authorized 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                    : "bg-indigo-600 text-white shadow-xl shadow-indigo-100"
                )}
              >
                {authorizing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : authorized ? (
                  <span className="text-xs font-black uppercase tracking-widest">授权已完成</span>
                ) : (
                  <span className="text-xs font-black uppercase tracking-widest">点击开始支付宝授权</span>
                )}
              </button>
            </div>
          </div>
        </section>

        <button
          onClick={handleConfirm}
          disabled={!realName || !authorized || submitting}
          className="w-full rounded-[1.5rem] bg-indigo-600 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:grayscale disabled:opacity-50"
        >
          {submitting ? '提交中...' : '确认绑定'}
        </button>
      </main>
    </div>
  );
}
