import React, { useEffect, useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import navConfig from '../config/nav.config.json';
import Breadcrumbs from '../components/Breadcrumbs';
import { listConversations } from '../services/chat';

function Header() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let timer: any;
    const load = async () => {
      try {
        if (!user?._id) { setUnread(0); return; }
        const list = await listConversations({ page: 1, limit: 50 });
        const total = list.reduce((acc: number, c: any) => acc + (c?.unread?.[user._id] || 0), 0);
        setUnread(total);
      } catch {}
    };
    load();
    // polling ligero cada 30s
    timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [user?._id]);
  const roleHome = user?.role === 'tenant' ? '/tenant'
    : user?.role === 'landlord' ? '/landlord'
    : user?.role === 'pro' ? '/pro'
    : user?.role === 'admin' ? '/admin'
    : '/properties';
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
        <Link to={roleHome} className="font-semibold text-lg">RentalApp</Link>
        <nav className="hidden md:flex items-center gap-2 text-sm">
          {user && (
            <Link to="/inbox" className="px-2 py-1 rounded hover:bg-gray-100">
              Inbox {unread > 0 && (
                <span className="ml-1 inline-flex items-center justify-center text-white bg-red-500 rounded-full text-[10px] px-1.5 py-0.5">{unread}</span>
              )}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {!user ? (
            <>
              <Link to="/login" className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Login</Link>
              <Link to="/register" className="px-3 py-1.5 rounded border border-gray-900 bg-gray-900 text-white hover:bg-black">Sign up</Link>
            </>
          ) : (
            <button onClick={logout} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Salir</button>
          )}
        </div>
      </div>
    </header>
  );
}

function SideNav() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let timer: any;
    const load = async () => {
      try {
        if (!user?._id) { setUnread(0); return; }
        const list = await listConversations({ page: 1, limit: 50 });
        const total = list.reduce((acc: number, c: any) => acc + (c?.unread?.[user._id] || 0), 0);
        setUnread(total);
      } catch {}
    };
    load();
    timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [user?._id]);
  const role = user?.role as 'tenant' | 'landlord' | 'pro' | 'admin' | undefined;
  const labelFor: Record<string, string> = {
    tenant: 'Inquilino',
    landlord: 'Propietario',
    pro: 'Profesional',
    admin: 'Administración',
  };
  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="sticky top-16 p-3 border border-gray-200 rounded bg-gray-50">
        <div className="text-xs uppercase tracking-wide text-gray-500 px-2 mb-2">General</div>
        <div className="grid gap-1">
          {(navConfig as any).general?.map((item: any) => (
            <NavLink key={item.path} className={({isActive})=>`px-2 py-1.5 rounded hover:bg-gray-100 ${isActive?'bg-gray-100 font-semibold':''}`} to={item.path}>
              {item.label}
              {item.path === '/inbox' && unread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center text-white bg-red-500 rounded-full text-[10px] px-1.5 py-0.5">{unread}</span>
              )}
            </NavLink>
          ))}
        </div>
        {role && (navConfig as any)[role] && (
          <>
            <div className="text-xs uppercase tracking-wide text-gray-500 px-2 mt-4 mb-2">{labelFor[role]}</div>
            <div className="grid gap-1">
              {((navConfig as any)[role] as any[]).map((item) => (
                <NavLink key={item.path} to={item.path} className={({isActive})=>`px-2 py-1.5 rounded hover:bg-gray-100 ${isActive?'bg-gray-100 font-semibold':''}`}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export default function AppShell() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex gap-6 h-[calc(100vh-56px)] overflow-hidden">
        <SideNav />
        <main className="flex-1 min-w-0 h-full overflow-y-auto pr-2">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
