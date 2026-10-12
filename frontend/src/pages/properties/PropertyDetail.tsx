import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Heart, MapPin, Share2, ShieldCheck } from 'lucide-react';
import { applyToProperty, favoriteProperty, getProperty, incrementView, unfavoriteProperty } from '../../services/properties';
import TenantProPanel from '../../components/TenantProPanel';
import LoginPrompt from '../../components/LoginPrompt';
import PropertyGallery from '../../components/property/PropertyGallery';
import SkeletonDetail from '../../components/ui/SkeletonDetail';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getTenantProInfo } from '../../services/tenantPro';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import {
  applicationText,
  depositText,
  formatRent,
  propertyFacts,
  propertyFeatures,
  recommendedIncome,
} from '../../utils/propertyDetail';
import type { Property } from '../../types/property';

const REGION_LABELS: Record<string, string> = {
  madrid: 'Comunidad de Madrid',
  galicia: 'Galicia',
  cataluna: 'Cataluña',
  catalunya: 'Cataluña',
};

const MANAGE_LINKS: Record<string, string> = {
  landlord: '/owner/properties',
  agency: '/agency/properties',
  admin: '/admin/properties',
};

const linkButton =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)]';

export default function PropertyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [promptLogin, setPromptLogin] = useState(false);
  const [applying, setApplying] = useState(false);

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', id, user?._id || 'anon'],
    queryFn: () => getProperty(id!),
    enabled: !!id,
    retry: false,
  });
  const isTenant = user?.role === 'tenant';
  const { data: tenantPro } = useQuery({
    queryKey: ['tenant-pro/me'],
    queryFn: getTenantProInfo,
    enabled: isTenant && !!property?.onlyTenantPro,
    staleTime: 10_000,
  });

  useDocumentTitle(property?.title || 'Vivienda');

  useEffect(() => {
    if (id) incrementView(id);
  }, [id]);

  if (isLoading) return <SkeletonDetail />;
  if (isError || !property) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Este anuncio ya no está disponible</h1>
        <p className="mt-2 text-sm text-gray-500">Puede que se haya alquilado o que el propietario lo haya retirado.</p>
        <Link to="/properties" className="mt-5 inline-block text-sm font-semibold text-[var(--ra-blue)] hover:underline">
          Ver otras viviendas
        </Link>
      </div>
    );
  }

  const setCached = (patch: Partial<Property>) =>
    qc.setQueryData<Property>(['property', id, user?._id || 'anon'], (prev) => (prev ? { ...prev, ...patch } : prev));

  const toggleFavorite = async () => {
    if (!user) return setPromptLogin(true);
    const liked = !!property._liked;
    setCached({ _liked: !liked });
    try {
      if (liked) await unfavoriteProperty(property._id);
      else await favoriteProperty(property._id);
    } catch {
      setCached({ _liked: liked });
      toast.push({ title: 'No se pudo actualizar tus guardados', tone: 'error' });
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: property.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.push({ title: 'Enlace copiado', tone: 'success' });
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.push({ title: 'No se pudo copiar el enlace', tone: 'error' });
    }
  };

  const apply = async () => {
    if (!user) return setPromptLogin(true);
    setApplying(true);
    try {
      await applyToProperty(property._id);
      setCached({ _application: { status: 'pending', createdAt: new Date().toISOString() } });
      toast.push({ title: 'Solicitud enviada', tone: 'success' });
    } catch (e: any) {
      const status = e?.response?.status;
      const message =
        status === 403 && e?.response?.data?.message
          ? e.response.data.message
          : status === 404
            ? 'Este anuncio ya no admite solicitudes'
            : 'No se pudo enviar la solicitud. Inténtalo de nuevo.';
      toast.push({ title: message, tone: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const photos = property.images?.length ? property.images : property.photos || [];
  const facts = propertyFacts(property);
  const features = propertyFeatures(property);
  const deposit = depositText(property.deposit, property.price);
  const region = property.region ? REGION_LABELS[property.region] || property.region : '';
  const place = [property.city, region].filter(Boolean).join(', ');
  const coords = property.location?.coordinates;
  const lng = coords?.[0];
  const lat = coords?.[1];
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0);
  const mapsQuery = encodeURIComponent([property.address, property.city].filter(Boolean).join(', ') || `${lat},${lng}`);
  const proRequired = !!property.onlyTenantPro;
  const proRent = property.requiredTenantProMaxRent || property.price;
  const proVerified = tenantPro?.status === 'verified';
  const proBlocked = proRequired && isTenant && !proVerified;
  const canApply = !property._mine && !property._application && (!user || isTenant) && !proBlocked;
  const mobileStatus = property._mine
    ? 'Es tu anuncio'
    : property._application
      ? applicationText(property._application).title
      : '';

  return (
    <div className="lg:pb-12">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={share} className={linkButton}>
            <Share2 size={16} aria-hidden />
            Compartir
          </button>
          {!property._mine && (
            <button type="button" onClick={toggleFavorite} className={linkButton} aria-pressed={!!property._liked}>
              <Heart size={16} aria-hidden className={property._liked ? 'fill-[var(--ra-ink)] text-[var(--ra-ink)]' : ''} />
              {property._liked ? 'Guardado' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      <PropertyGallery photos={photos} title={property.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <header>
            <h1 className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl [overflow-wrap:anywhere]">
              {property.title}
            </h1>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
              <span>{[property.address, place].filter(Boolean).join(' · ')}</span>
            </p>
            {facts.length > 0 && <p className="mt-4 text-base font-medium text-gray-900">{facts.join(' · ')}</p>}
          </header>

          <section className="border-t border-[var(--ra-line)] pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Características</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-3 text-sm text-gray-700 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check size={16} className="shrink-0 text-gray-400" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-[var(--ra-line)] pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Descripción</h2>
            {property.description?.trim() ? (
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
                {property.description}
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-500">El anunciante no ha añadido descripción.</p>
            )}
          </section>

          {hasCoords && (
            <section className="border-t border-[var(--ra-line)] pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Ubicación</h2>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[var(--ra-blue)] hover:underline"
                >
                  Abrir en Google Maps
                </a>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--ra-line)]">
                <iframe
                  title={`Mapa de ${property.title}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${[lng - 0.01, lat - 0.006, lng + 0.01, lat + 0.006].join('%2C')}&layer=mapnik&marker=${lat}%2C${lng}`}
                  className="h-72 w-full"
                  loading="lazy"
                />
              </div>
            </section>
          )}

          {isTenant && proRequired && !proVerified && (
            <section className="border-t border-[var(--ra-line)] pt-6">
              <TenantProPanel requiredRent={proRent} />
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-2xl border border-[var(--ra-line)] bg-white p-6 shadow-[0_12px_32px_rgba(8,16,45,0.06)]">
            <p className="font-['Manrope',sans-serif] text-3xl font-bold tracking-tight text-gray-950 tabular-nums">
              {formatRent(property.price)}
              <span className="ml-1 text-base font-medium text-gray-500">/mes</span>
            </p>
            {deposit && <p className="mt-1 text-sm text-gray-600">Fianza: {deposit}</p>}

            {proRequired && (
              <div className="mt-5 border-t border-[var(--ra-line)] pt-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-gray-900">
                  <ShieldCheck size={16} className="text-[var(--ra-blue)]" aria-hidden />
                  Solo inquilinos con Tenant PRO
                </p>
                <p className="mt-1.5 leading-relaxed text-gray-600">
                  El propietario pide la solvencia verificada. Como referencia, ingresos de unos{' '}
                  <span className="font-medium text-gray-900 tabular-nums">{formatRent(recommendedIncome(proRent))}</span> al mes
                  (la renta no pasa del 35 %).
                </p>
              </div>
            )}

            <div className="mt-5 border-t border-[var(--ra-line)] pt-5">
              <ApplyBlock
                property={property}
                signedIn={!!user}
                role={user?.role}
                isTenant={isTenant}
                proBlocked={proBlocked}
                applying={applying}
                onApply={apply}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* En móvil la tarjeta del precio queda al final: el precio y la acción van siempre a mano */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-[var(--ra-line)] bg-white px-4 py-3 lg:hidden">
        <p className="font-['Manrope',sans-serif] text-lg font-bold text-gray-950 tabular-nums">
          {formatRent(property.price)}
          <span className="ml-1 text-sm font-medium text-gray-500">/mes</span>
        </p>
        {canApply ? (
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="rounded-full bg-[var(--ra-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {applying ? 'Enviando…' : 'Solicitar visita'}
          </button>
        ) : (
          mobileStatus && <span className="text-right text-sm font-medium text-gray-700">{mobileStatus}</span>
        )}
      </div>

      <LoginPrompt open={promptLogin} onClose={() => setPromptLogin(false)} />
    </div>
  );
}

function ApplyBlock({
  property,
  signedIn,
  role,
  isTenant,
  proBlocked,
  applying,
  onApply,
}: {
  property: Property;
  signedIn: boolean;
  role?: string;
  isTenant: boolean;
  proBlocked: boolean;
  applying: boolean;
  onApply: () => void;
}) {
  const primary =
    'w-full rounded-full bg-[var(--ra-blue)] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#3557e6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  if (property._mine) {
    const views = Number(property.viewsCount) || 0;
    return (
      <div className="text-sm">
        <p className="font-semibold text-gray-900">Es tu anuncio</p>
        <p className="mt-1 text-gray-600">
          {property.status === 'active'
            ? `Publicado · ${views.toLocaleString('es-ES')} ${views === 1 ? 'visita' : 'visitas'}`
            : 'No está publicado: los inquilinos no lo ven.'}
        </p>
        {role && MANAGE_LINKS[role] && (
          <Link to={MANAGE_LINKS[role]} className="mt-3 inline-block font-semibold text-[var(--ra-blue)] hover:underline">
            Gestionar inmuebles
          </Link>
        )}
      </div>
    );
  }

  if (property._application) {
    const { title, detail } = applicationText(property._application);
    return (
      <div className="text-sm" role="status">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 leading-relaxed text-gray-600">{detail}</p>
        <Link to="/tenant/applications" className="mt-3 inline-block font-semibold text-[var(--ra-blue)] hover:underline">
          Ver mis solicitudes
        </Link>
      </div>
    );
  }

  if (signedIn && !isTenant) {
    return <p className="text-sm text-gray-600">Las visitas se solicitan desde una cuenta de inquilino.</p>;
  }

  if (proBlocked) {
    return (
      <div className="text-sm">
        <button type="button" disabled className={primary}>
          Solicitar visita
        </button>
        <p className="mt-3 leading-relaxed text-gray-600">
          Para solicitarla necesitas Tenant PRO verificado.{' '}
          <Link to="/tenant-pro" className="font-semibold text-[var(--ra-blue)] hover:underline">
            Verificar mi solvencia
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onApply} disabled={applying} className={primary}>
        {applying ? 'Enviando…' : 'Solicitar visita'}
      </button>
      <p className="mt-3 text-center text-xs text-gray-500">
        {signedIn ? 'El propietario te propondrá una fecha. No tiene coste.' : 'Te pediremos iniciar sesión. No tiene coste.'}
      </p>
    </div>
  );
}
