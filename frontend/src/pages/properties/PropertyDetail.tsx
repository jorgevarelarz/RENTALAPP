import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { applyToProperty, favoriteProperty, getProperty, incrementView, unfavoriteProperty } from '../../services/properties';
import TenantProPanel from '../../components/TenantProPanel';
import { useAuth } from '../../context/AuthContext';
import { getTenantProInfo, type TenantProInfo } from '../../services/tenantPro';
import LoginPrompt from '../../components/LoginPrompt';
import toast from 'react-hot-toast';
import SkeletonDetail from '../../components/ui/SkeletonDetail';

export default function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [liked, setLiked] = useState(false);
  const { user } = useAuth();
  const [tp, setTp] = useState<TenantProInfo | null>(null);
  const [promptLogin, setPromptLogin] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const detail = await getProperty(id);
      setProperty(detail);
      await incrementView(id);
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      if (user?.role === 'tenant') {
        try { const info = await getTenantProInfo(); setTp(info as any); } catch {}
      } else {
        setTp(null);
      }
    })();
  }, [user?._id, user?.role]);

  const toggleFavorite = async () => {
    if (!property?._id) return;
    if (!user) { setPromptLogin(true); return; }
    if (liked) {
      await unfavoriteProperty(property._id);
    } else {
      await favoriteProperty(property._id);
    }
    setLiked(!liked);
  };

  if (!property) return <SkeletonDetail />;

  const images = property.images?.length ? property.images : ['https://via.placeholder.com/1000x600?text=Property'];
  const requiredRent = property.onlyTenantPro ? property.requiredTenantProMaxRent || property.price : undefined;
  const tenantBadge = property.onlyTenantPro ? (
    <div
      style={{
        background: '#dbeafe',
        color: '#1d4ed8',
        padding: '6px 12px',
        borderRadius: 999,
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      Solo inquilinos PRO · mínimo {requiredRent} €/mes
    </div>
  ) : null;

  const incomeBlock = property.onlyTenantPro ? (
    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Requisito orientativo de ingresos (seguro de impago)</div>
      {(() => {
        const p = Number(property.price || 0);
        if (!p) return <div>—</div>;
        const inc35 = Math.ceil(p / 0.35);
        const inc30 = Math.ceil(p / 0.30);
        const inc40 = Math.ceil(p / 0.40);
        return (
          <div>
            <div style={{ marginBottom: 6 }}>Mínimo recomendado (35%): <strong>{inc35.toLocaleString()} € / mes</strong></div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Estricto 30%: ≈ {inc30.toLocaleString()} € / mes</li>
              <li>Flexible 40%: ≈ {inc40.toLocaleString()} € / mes</li>
            </ul>
          </div>
        );
      })()}
      <div style={{ marginTop: 6, color: '#6B7280' }}>Tu validación Tenant PRO debe ser ≥ la renta. Estos importes son orientativos.</div>
    </div>
  ) : null;

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <h2>{property.title}</h2>
      {tenantBadge}
      <div style={{ display: 'grid', gap: 8 }}>
        <img
          src={images[0]}
          alt={property.title}
          style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 10 }}
        />
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {images.slice(1).map((src: string, index: number) => (
              <img key={index} src={src} alt={`${property.title}-${index}`} style={{ height: 90, borderRadius: 6 }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{property.price} € / mes</div>
          <div style={{ color: '#666' }}>
            {property.city} · {property.rooms} hab · {property.bathrooms} baños · {property.sizeM2 || '—'} m²
          </div>
        </div>
        <button onClick={toggleFavorite} title={!user ? 'Inicia sesión para guardar favoritos' : ''} disabled={!user}>
          {liked ? '❤️ Quitar de favoritos' : '🤍 Añadir a favoritos'}
        </button>
      </div>

      {user?.role === 'tenant' && <TenantProPanel requiredRent={requiredRent} />}

      <div>
        <button
          onClick={async () => {
            if (!property?._id) return;
            try {
              await applyToProperty(property._id);
              toast.success('Solicitud enviada');
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.response?.data?.error || 'No se pudo enviar la solicitud');
            }
          }}
          disabled={user?.role !== 'tenant'}
          title={
            property.onlyTenantPro && user?.role === 'tenant' && (!tp || tp.status !== 'verified')
              ? 'Esta propiedad solo admite solicitudes de inquilinos con solvencia verificada (PRO).'
              : undefined
          }
          style={{
            background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
            opacity: user?.role !== 'tenant' ? 0.6 : 1,
          }}
        >
          Solicitar alquiler
        </button>
        {property.onlyTenantPro && user?.role === 'tenant' && (!tp || tp.status !== 'verified') && (
          <div style={{ marginTop: 8, color: '#b91c1c' }}>
            Solo inquilinos PRO. <a href="/tenant-pro">Hazte PRO</a> para optar a esta vivienda.
          </div>
        )}
      </div>

      <div>
        <h3>Descripción</h3>
        <p>{property.description || 'Sin descripción.'}</p>
      </div>

      <div>
        <h3>Características</h3>
        <ul>
          <li>Mascotas: {property.petsAllowed ? 'Sí' : 'No'}</li>
          <li>Amueblado: {property.furnished ? 'Sí' : 'No'}</li>
          <li>
            Disponible desde: {property.availableFrom ? new Date(property.availableFrom).toLocaleDateString() : '—'}
          </li>
        </ul>
      </div>
      {incomeBlock}
      <LoginPrompt open={promptLogin} onClose={() => setPromptLogin(false)} />
    </div>
  );
}
