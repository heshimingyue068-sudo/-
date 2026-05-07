import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Home from './pages/h5/Home';
import CategoryList from './pages/h5/CategoryList';
import BrandDetail from './pages/h5/BrandDetail';
import OrderList from './pages/h5/OrderList';
import OrderDetail from './pages/h5/OrderDetail';
import BindAlipay from './pages/h5/BindAlipay';
import TransactionHistory from './pages/h5/TransactionHistory';
import Profile from './pages/h5/Profile';
import AdminOrders from './pages/admin/Orders';
import AdminOrderApprovals from './pages/admin/OrderApprovals';
import AdminBrands from './pages/admin/Brands';
import AdminCategories from './pages/admin/Categories';
import AdminProducts from './pages/admin/Products';
import AdminUsers from './pages/admin/Users';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminWithdrawalDetail from './pages/admin/WithdrawalDetail';
import Navbar from './components/Navbar';
import AdminSidebar from './components/AdminSidebar';

export default function App() {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* H5 Routes */}
        <Route path="/" element={<HomeLayout />}>
          <Route index element={<Home />} />
          <Route path="categories" element={<CategoryList />} />
          <Route path="brand/:id" element={<BrandDetail />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="order/:id" element={<OrderDetail />} />
          <Route path="bind-alipay" element={<BindAlipay />} />
          <Route path="transaction-history" element={<TransactionHistory />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={isAdmin ? <AdminLayout /> : <Navigate to="/" />}>
          <Route index element={<Navigate to="/admin/orders" replace />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="withdrawals" element={<AdminOrderApprovals />} />
          <Route path="withdrawals/:id" element={<AdminWithdrawalDetail />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function HomeLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-2xl overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <Navbar />
    </div>
  );
}

function AdminLayout() {
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-slate-100 md:rounded-tl-[3.5rem] shadow-2xl relative z-0">
         <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">系统管理后台</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">全局寄售控制中心</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-black text-slate-800">管理员</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">超级管理权限</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-100 border-2 border-indigo-50"></div>
          </div>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
