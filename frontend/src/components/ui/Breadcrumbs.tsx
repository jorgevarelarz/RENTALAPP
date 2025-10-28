import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import nav from '../../config/nav.config.json';

function prettyId(id: string) {
  if (!id) return '';
  const short = id.length > 6 ? id.slice(-6) : id;
  return short.toUpperCase();
}

function labelFor(path: string): string {
  const cfg: any = nav;
  const all = (Object.values(cfg) as any[]).flat();
  const item = all.find((i: any) => i.path === path);
  if (item?.label) return item.label;
  // Dynamic labels for known patterns
  if (/^\/contracts\/[a-z0-9]+/i.test(path)) return `Contrato #${prettyId(path.split('/').pop() || '')}`;
  if (/^\/tickets\/[a-z0-9]+/i.test(path)) return `Ticket #${prettyId(path.split('/').pop() || '')}`;
  if (/^\/properties\/[a-z0-9]+/i.test(path)) return `Propiedad #${prettyId(path.split('/').pop() || '')}`;
  return path.split('/').pop() || '';
}

const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    crumbs.push('/' + parts.slice(0, i + 1).join('/'));
  }
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
