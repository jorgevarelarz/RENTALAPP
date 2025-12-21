import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { applyToProperty, favoriteProperty, getProperty, incrementView, unfavoriteProperty } from '../../services/properties';
import TenantProPanel from '../../components/TenantProPanel';
import { useAuth } from '../../context/AuthContext';
import { getTenantProInfo, type TenantProInfo } from '../../services/tenantPro';
import LoginPrompt from '../../components/LoginPrompt';
import toast from 'react-hot-toast';
import SkeletonDetail from '../../components/ui/SkeletonDetail';
import { MapPin, BedDouble, Bath, Ruler, PawPrint, Sofa, Calendar, Share2, Heart, ShieldCheck } from 'lucide-react';

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
      setLiked(!!detail._liked);
      await incrementView(id);
    })();
  }, [id]);

  useEffect(() => {
    if (user?.role === 'tenant') {
      getTenantProInfo().then(info => setTp(info as any)).catch(() => {});
    }
  }, [user]);

  const toggleFavorite = async () => {
    if (!property?._id) return;
    if (!user) { setPromptLogin(true); return; }
    try {
      if (liked) await unfavoriteProperty(property._id);
      else await favoriteProperty(property._id);
      setLiked(!liked);
      toast.success(liked ? 'Eliminado de favoritos' : 'Añadido a favoritos');
    } catch {
      toast.error('Error al actualizar favoritos');
    }
  };

  const handleApply = async () => {
    if (!user) { setPromptLogin(true); return; }
    if (property.onlyTenantPro && tp?.status !== 'verified') {
      toast.error('Requieres perfil Tenant PRO verificado');
      return;
    }
    try {
      await applyToProperty(property._id);
      toast.success('¡Solicitud enviada con éxito!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ya has solicitado esta propiedad o hubo un error');
    }
  };

  if (!property) return <SkeletonDetail />;

  const images = property.images?.length ? property.images : ['https://via.placeholder.com/1200x800?text=Sin+Imagen'];
  const safeRent35 = Math.ceil((property.price || 0) / 0.35);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{property.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <span className="font-medium underline decoration-dotted">{property.address}, {property.city}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleFavorite} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Heart size={18} className={liked ? "fill-red-500 text-red-500" : "text-gray-600"} />
              <span className="underline">Guardar</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Share2 size={18} />
              <span className="underline">Compartir</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-2 h-[400px] md:h-[500px] mb-10 rounded-2xl overflow-hidden shadow-sm">
        <div className="md:col-span-2 md:row-span-2 relative group cursor-pointer">
          <img src={images[0]} alt="Principal" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
        <div className="hidden md:block relative group cursor-pointer">
          <img src={images[1] || images[0]} alt="Secundaria 1" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
        <div className="hidden md:block relative group cursor-pointer rounded-tr-2xl">
          <img src={images[2] || images[0]} alt="Secundaria 2" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
        <div className="hidden md:block relative group cursor-pointer">
          <img src={images[3] || images[0]} alt="Secundaria 3" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
        <div className="hidden md:block relative group cursor-pointer rounded-br-2xl">
          <img src={images[4] || images[0]} alt="Secundaria 4" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          {images.length > 5 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg hover:bg-black/40 transition-colors">
              Ver todas ({images.length})
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div className="flex flex-wrap gap-6 py-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-full"><BedDouble className="text-gray-700" size={24}/></div>
              <div><p className="font-bold">{property.rooms} Habitaciones</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-full"><Bath className="text-gray-700" size={24}/></div>
              <div><p className="font-bold">{property.bathrooms} Baños</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-full"><Ruler className="text-gray-700" size={24}/></div>
              <div><p className="font-bold">{property.sizeM2} m²</p></div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Lo que ofrece este lugar</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-gray-700">
                <PawPrint className={property.petsAllowed ? "text-green-600" : "text-gray-400"} />
                <span className={!property.petsAllowed ? "line-through text-gray-400" : ""}>Mascotas permitidas</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Sofa className={property.furnished ? "text-green-600" : "text-gray-400"} />
                <span>{property.furnished ? "Totalmente amueblado" : "Sin amueblar"}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Calendar className="text-blue-600" />
                <span>Disponible: {property.availableFrom ? new Date(property.availableFrom).toLocaleDateString() : "Inmediata"}</span>
              </div>
              {property.onlyTenantPro && (
                <div className="flex items-center gap-3 text-blue-700 font-medium">
                  <ShieldCheck />
                  <span>Verificación Tenant PRO requerida</span>
                </div>
              )}
            </div>
          </div>

          <div className="py-6 border-t border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Acerca de este alojamiento</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {property.description || "El propietario no ha proporcionado una descripción detallada."}
            </p>
          </div>

          {user?.role === 'tenant' && (
            <div className="py-6 border-t border-gray-100">
              <TenantProPanel requiredRent={property.onlyTenantPro ? (property.requiredTenantProMaxRent || property.price) : undefined} />
            </div>
          )}
        </div>

        <div className="relative">
          <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 shadow-xl p-6 space-y-6">
            <div className="flex justify-between items-end border-b border-gray-100 pb-4">
              <div>
                <span className="text-3xl font-bold text-gray-900">{property.price?.toLocaleString()} €</span>
                <span className="text-gray-500"> / mes</span>
              </div>
              <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">
                Fianza: {property.deposit ? `${property.deposit} €` : '1 mes'}
              </span>
            </div>

            {property.onlyTenantPro && (
              <div className="bg-blue-50 p-4 rounded-xl text-sm space-y-2 text-blue-800">
                <div className="flex items-start gap-2 font-semibold">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0"/>
                  <span>Solo Inquilinos PRO</span>
                </div>
                <p className="text-blue-600/80 text-xs leading-relaxed">
                  Esta propiedad requiere solvencia verificada. Se recomiendan ingresos aprox. de <strong>{safeRent35.toLocaleString()} €/mes</strong> (35% ratio).
                </p>
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={user?.role !== 'tenant' && !!user}
              className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                user?.role !== 'tenant' && user
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg hover:shadow-blue-500/30'
              }`}
            >
              {!user ? 'Inicia sesión para aplicar' : user.role === 'tenant' ? 'Solicitar Alquiler' : 'Vista Propietario'}
            </button>

            <div className="text-center text-xs text-gray-400">
              No se te cobrará nada todavía.
            </div>
          </div>
        </div>
      </div>

      <LoginPrompt open={promptLogin} onClose={() => setPromptLogin(false)} />
    </div>
  );
}
