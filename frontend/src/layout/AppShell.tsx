import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity, BadgeCheck, BarChart3, Bath, Briefcase, Building2, CalendarDays,
  CircleDot, CreditCard, HardHat, Menu, X, FileSignature, FileText, Heart, Home, Map as MapIcon,
  MessageSquare, Receipt, Scale, Search, Settings, ShieldCheck, Sparkles,
  User, Users, Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import navConfig from '../config/nav.config.json';
import Breadcrumbs from '../components/Breadcrumbs';
import Brand from '../components/Brand';
import { roleHome } from '../utils/roleHome';
import { authHref } from '../utils/authLinks';
import Drawer from '../components/ui/Drawer';
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
  [/^\/pros/, HardHat],
  [/owner\/properties|admin\/properties|agency\/properties/, Building2],
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

function Header({ unread, menuOpen, onOpenMenu }: { unread: number; menuOpen: boolean; onOpenMenu: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const home = roleHome(user?.role);
  return (
    <header className="ra-app-header">
      <div className="ra-app-header-inner">
        <button
          type="button"
          className="ra-app-menu-button lg:hidden"
          onClick={onOpenMenu}
          aria-label={unread > 0 ? `Abrir menú (${unread} mensajes sin leer)` : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="ra-mobile-nav"
        >
          <Menu size={18} />
          {unread > 0 && <span className="ra-app-menu-dot" aria-hidden="true" />}
        </button>
        <Brand to={home} />
        <nav className="hidden md:flex items-center gap-1 text-sm ml-2">
          {user && (
            <Link to="/inbox" className="ra-app-inbox">
              <MessageSquare size={15} />
              Mensajes
              {unread > 0 && (
                <span className="inline-flex items-center justify-center text-white bg-red-500 rounded-full text-[10px] font-semibold px-1.5 py-0.5">{unread}</span>
              )}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2.5 text-sm">
          {!user ? (
            <>
              <Link to={authHref('/login', location)} className="ra-app-login">Entrar</Link>
              <Link to={authHref('/register', location)} className="ra-button ra-button-blue ra-button-small ra-app-register">Crear cuenta</Link>
            </>
          ) : (
            <>
              <span className="text-gray-500 hidden sm:inline text-[13px]">{user.email}</span>
              <button onClick={logout} className="ra-app-login">Salir</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ item, unread, onNavigate }: { item: { path: string; label: string }; unread: number; onNavigate?: () => void }) {
  const Icon = iconFor(item.path);
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      end={/^\/(tenant|landlord|pro|admin|agency)$/.test(item.path)}
      className={({ isActive }) =>
        `ra-side-link group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors ${
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

const roleLabels: Record<string, string> = {
  tenant: 'Inquilino',
  landlord: 'Propietario',
  pro: 'Profesional',
  admin: 'Administración',
  agency: 'Agencia',
};

const sectionTitle = 'text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5';

// Sin sesión, Mensajes y Asistente solo llevarían al login: en su lugar, qué da la cuenta y cómo entrar
function GuestAccount({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <div className="ra-guest-account">
      <p>Con una cuenta guardas pisos, pides visitas y hablas con el propietario.</p>
      <Link to={authHref('/register', location)} onClick={onNavigate} className="ra-button ra-button-blue ra-button-small">Crear cuenta</Link>
      <Link to={authHref('/login', location)} onClick={onNavigate} className="ra-app-login">Entrar</Link>
    </div>
  );
}

// Enlaces del menú; los comparten el lateral de escritorio y el menú desplegable del móvil
function NavSections({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const { user } = useAuth();
  const role = user?.role as 'tenant' | 'landlord' | 'pro' | 'admin' | 'agency' | undefined;
  const guestItems = [{ path: '/properties', label: 'Buscar pisos' }];
  return (
    <>
      {!role ? (
        <>
          <div className={sectionTitle}>Explorar</div>
          <div className="grid gap-0.5">
            {guestItems.map((item) => <NavItem key={item.path} item={item} unread={0} onNavigate={onNavigate} />)}
          </div>
          <GuestAccount onNavigate={onNavigate} />
        </>
      ) : (
        <>
          <div className={sectionTitle}>General</div>
          <div className="grid gap-0.5">
            {(navConfig as any).general?.map((item: any) => (
              <NavItem key={item.path} item={item} unread={unread} onNavigate={onNavigate} />
            ))}
          </div>
        </>
      )}
      {role && (navConfig as any)[role] && (
        <>
          <div className={`${sectionTitle} mt-5`}>{roleLabels[role]}</div>
          <div className="grid gap-0.5">
            {((navConfig as any)[role] as any[]).map((item) => (
              <NavItem key={item.path} item={item} unread={0} onNavigate={onNavigate} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SideNav({ unread }: { unread: number }) {
  return (
    <aside className="ra-side-nav hidden lg:block w-60 shrink-0">
      <div className="sticky top-20 pr-2">
        <NavSections unread={unread} />
      </div>
    </aside>
  );
}

function MobileNav({ open, onClose, unread }: { open: boolean; onClose: () => void; unread: number }) {
  const { user } = useAuth();
  return (
    <Drawer open={open} onClose={onClose} side="left" width={300} label="Menú">
      <div id="ra-mobile-nav">
        <div className="ra-mobile-nav-head">
          <span className="text-[15px] font-semibold text-gray-950">Menú</span>
          <button type="button" className="ra-app-menu-button" onClick={onClose} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <NavSections unread={unread} onNavigate={onClose} />
        {user?.email && <div className="ra-mobile-nav-foot">{user.email}</div>}
      </div>
    </Drawer>
  );
}

export default function AppShell() {
  // Un solo sondeo de mensajes sin leer para la cabecera y los dos menús
  const unread = useUnread();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  return (
    <div className="min-h-screen ra-app-shell">
      <Header unread={unread} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onClose={closeMenu} unread={unread} />
      <div className="ra-app-frame mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex gap-6 h-[calc(100vh-68px)] overflow-hidden">
        <SideNav unread={unread} />
        <main className="ra-app-content flex-1 min-w-0 h-full overflow-y-auto pr-2">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
