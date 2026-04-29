import { useState } from 'react';
import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      // Virtual login: Just set a mock ID in localStorage and reload
      const mockId = 'virtual_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('virtual_user_id', mockId);
      
      // We need to trigger a re-render or a reload for useAuth to pick it up.
      // A simple window.location.href to home is effective.
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      alert('登录失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-200">
        <LogIn size={44} />
      </div>
      
      <h1 className="mb-3 text-4xl font-black tracking-tight text-slate-800">欢迎回来</h1>
      <p className="mb-14 text-sm font-medium text-slate-500">闲置寄售，极速变现</p>

      <div className="w-full space-y-4">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className={cn(
            "flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-5 font-black text-slate-800 shadow-xl shadow-slate-200 transition-all hover:bg-slate-50 active:scale-[0.98]",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
          {loading ? '连接中...' : 'Google 账号登录'}
        </button>

        <div className="py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          通过登录，您同意我们的 <span className="text-indigo-600">服务条款</span>
        </div>
      </div>
    </div>
  );
}
