import React, { useEffect, useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import {
  Activity, BadgeCheck, BarChart3, Bath, Briefcase, Building2, CalendarDays,
  CircleDot, CreditCard, FileSignature, FileText, Heart, Home, Map as MapIcon,
  MessageSquare, Receipt, Scale, Search, Settings, ShieldCheck, Sparkles,
  User, Users, Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import navConfig from '../config/nav.config.json';
import Breadcrumbs from '../components/Breadcrumbs';
import Badge from '../components/ui/Badge';
import { listConversations } from '../services/chat';

type LucideIcon = React.ComponentType<{ size?: number | string; className?: string }>;

const iconRules: Array<[RegExp, LucideIcon]> = [
  [/^\/inbox/, MessageSquare],
  [/^\/assistant/, Sparkles],
  [/^\/properties/, Search],
  [/favorites/, Heart],
  [/applications/, FileText],
  [/^\/contracts/, FileSignature],
  [/payments/, CreditCard],
  [/kyc/, ShieldCheck],
  [/tenant-pro/, BadgeCheck],
  [/^\/tenant$/, Home],
  [/^\/landlord$/, Home],
  [/^\/pro$/, Home],
  [/^\/admin$/, Home],
  [/owner\/properties|admin\/properties/, Building2],
  [/tickets|issues|incidents/, Wrench],
  [/showings/, CalendarDays],
  [/services/, Briefcase],
  [/quotes/, FileText],
  [/billing/, Receipt],
  [/admin\/users/, Users],
  [/agency\/landlords/, Users],
  [/reports/, BarChart3],
  [/settings/, Settings],
  [/tensioned-areas/, MapIcon],
  [/compliance/, Scale],
  [/system-events/, Activity],
  [/profile/, User],
  [/bath/, Bath],
];

function iconFor(path: string): LucideIcon {
  const hit = iconRules.find(([re]) => re.test(path));
  return hit ? hit[1] : CircleDot;
}

function useUnread() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let timer: any;
    const load = async () => {
      try {
        if (!user?._id) { setUnread(0); return; }
        const list = await listConversations({ page: 1, limit: 50, kind: 'direct' });
        const total = list.reduce((acc: number, c: any) => acc + (c?.unread?.[user._id] || 0), 0);
        setUnread(total);
      } catch {}
    };
    load();
    // polling ligero cada 30s
    timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [user?._id]);
  return unread;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center text-white bg-red-500 rounded-full text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px]">
      {count}
    </span>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const unread = useUnread();
  const roleHome = user?.role === 'tenant' ? '/tenant'
    : user?.role === 'landlord' ? '/landlord'
    : user?.role === 'pro' ? '/pro'
    : user?.role === 'admin' ? '/admin'
    : user?.role === 'agency' ? '/agency'
    : '/';
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
        <Link to={roleHome} className="flex items-center gap-2.5 font-semibold text-[1.05rem] tracking-tight text-gray-950 hover:text-indigo-600">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950 text-white">
            <Building2 size={17} />
          </span>
          RentalApp
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm ml-2">
          {user && (
            <Link to="/inbox" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-950">
              <MessageSquare size={15} />
              Inbox
              {unread > 0 && (
                <span className="inline-flex items-center justify-center text-white bg-red-500 rounded-full text-[10px] font-semibold px-1.5 py-0.5">{unread}</span>
              )}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2.5 text-sm">
          {!user ? (
            <>
              <Link to="/login" className="px-3.5 py-1.5 rounded-md text-gray-700 border border-gray-300 hover:bg-gray-50 font-medium">Entrar</Link>
              <Link to="/register" className="hidden sm:inline-flex px-3.5 py-1.5 rounded-md bg-gray-950 text-white font-medium hover:bg-gray-800">Crear cuenta</Link>
            </>
          ) : (
            <>
              <span className="text-gray-500 hidden sm:inline text-[13px]">{user.email}</span>
              {user?.isVerified && (
                <Badge tone="highlight">KYC verificado</Badge>
              )}
              <button onClick={logout} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Salir</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ item, unread }: { item: { path: string; label: string }; unread: number }) {
  const Icon = iconFor(item.path);
  return (
    <NavLink
      to={item.path}
      end={/^\/(tenant|landlord|pro|admin)$/.test(item.path)}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors ${
          isActive
            ? 'bg-gray-100 text-gray-950 font-semibold'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'} />
          <span className="truncate">{item.label}</span>
          {item.path === '/inbox' && <UnreadBadge count={unread} />}
        </>
      )}
    </NavLink>
  );
}

function SideNav() {
  const { user } = useAuth();
  const unread = useUnread();
  const role = user?.role as 'tenant' | 'landlord' | 'pro' | 'admin' | 'agency' | undefined;
  const labelFor: Record<string, string> = {
    tenant: 'Inquilino',
    landlord: 'Propietario',
    pro: 'Profesional',
    admin: 'Administración',
    agency: 'Agencia',
  };
  const guestItems = [{ path: '/properties', label: 'Buscar pisos' }];
  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="sticky top-16 pr-2">
        {!role && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">Explorar</div>
            <div className="grid gap-0.5 mb-5">
              {guestItems.map((item) => <NavItem key={item.path} item={item} unread={0} />)}
            </div>
          </>
        )}
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">General</div>
        <div className="grid gap-0.5">
          {(navConfig as any).general?.map((item: any) => (
            <NavItem key={item.path} item={item} unread={unread} />
          ))}
        </div>
        {role && (navConfig as any)[role] && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mt-5 mb-1.5">{labelFor[role]}</div>
            <div className="grid gap-0.5">
              {((navConfig as any)[role] as any[]).map((item) => (
                <NavItem key={item.path} item={item} unread={0} />
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
