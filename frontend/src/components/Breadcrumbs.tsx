import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import nav from '../config/nav.config.json';
import { useAuth } from '../context/AuthContext';

/** Lista de incidencias de cada rol: la ficha /tickets/:id cuelga de la suya, no de «Mis incidencias». */
const TICKET_LISTS: Record<string, string> = { landlord: '/landlord/issues', pro: '/pro/tickets' };

function labelFor(path: string): string {
  const cfg: any = nav;
  const all = (Object.values(cfg) as any[]).flat();
  const item = all.find((i: any) => i.path === path);
  if (item?.label) return item.label;
  if (path === '/contracts/new') return 'Nuevo contrato';
  if (path === '/tickets/new') return 'Comunicar una avería';
  // Fichas: sin el ID interno a la vista, el título ya está en la cabecera de la página.
  if (/^\/contracts\/[a-z0-9]+\/signed$/i.test(path)) return 'Contrato firmado';
  if (/^\/contracts\/[a-z0-9]+$/i.test(path)) return 'Contrato';
  if (/^\/tickets\/[a-z0-9]+$/i.test(path)) return 'Incidencia';
  if (/^\/properties\/[a-z0-9]+$/i.test(path)) return 'Inmueble';
  if (path === '/pros') return 'Profesionales';
  if (/^\/pros\/[a-z0-9]+$/i.test(path)) return 'Profesional';
  return path.split('/').pop() || '';
}

const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const role = useAuth()?.user?.role;
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    crumbs.push('/' + parts.slice(0, i + 1).join('/'));
  }
  const ticketList = role ? TICKET_LISTS[role] : undefined;
  if (ticketList && crumbs[0] === '/tickets' && crumbs.length > 1) crumbs[0] = ticketList;
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" style={{ fontSize: 12, marginBottom: 12, color: 'var(--muted)' }}>
      {crumbs.map((c, i) => (
        <span key={c}>
          {i < crumbs.length - 1 ? (
            <>
              <Link to={c}>{labelFor(c)}</Link>
              <span style={{ margin: '0 6px' }}>/</span>
            </>
          ) : (
            <span style={{ color: 'var(--fg)' }}>{labelFor(c)}</span>
          )}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
