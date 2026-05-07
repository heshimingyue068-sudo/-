import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, ShoppingCart, Tag, Settings, LogOut, Landmark, Layers, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

export default function AdminSidebar() {
  const location = useLocation();

  const menuItems = [
    { label: '返回用户端', icon: LogOut, path: '/' },
    { label: '订单管理', icon: ShoppingCart, path: '/admin/orders' },
    { label: '订单审批', icon: Landmark, path: '/admin/withdrawals' },
    { label: '类目管理', icon: Layers, path: '/admin/categories' },
    { label: '品牌管理', icon: Tag, path: '/admin/brands' },
    { label: '商品管理', icon: Settings, path: '/admin/products' },
    { label: '用户管理', icon: Users, path: '/admin/users' },
  ];

  const handleSignOut = () => {
    localStorage.removeItem('virtual_user_id');
    signOut(auth);
    window.location.href = '/login';
  };

  return (
    <aside className="flex w-64 flex-col bg-slate-900 text-slate-400">
      <div className="flex h-20 items-center px-6 gap-3">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
          <ShieldCheck size={18} />
        </div>
        <span className="text-lg font-black text-white tracking-tight uppercase">管理控制台</span>
      </div>
      
      <nav className="flex-1 space-y-1 p-3">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" 
                  : "hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
        >
          <LogOut size={18} />
          退出登录
        </button>
      </div>
    </aside>
  );
}
