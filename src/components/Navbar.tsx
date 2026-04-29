import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, User, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { label: '首页', icon: Home, path: '/' },
    { label: '寄售', icon: Zap, path: '/categories' },
    { label: '订单', icon: ClipboardList, path: '/orders' },
    { label: '我的', icon: User, path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-slate-100 bg-white px-2 pt-1 pb-6 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      {navItems.map((item, idx) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all active:scale-90 flex-1",
              isActive ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <div className={cn("p-1.5 rounded-xl transition-all", isActive && "bg-indigo-50")}>
              <item.icon size={22} className={cn("transition-colors", isActive ? "text-indigo-600" : "text-slate-400")} />
            </div>
            <span className={cn("text-[10px] font-bold tracking-tight text-center w-full", isActive ? "text-indigo-600" : "text-slate-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
