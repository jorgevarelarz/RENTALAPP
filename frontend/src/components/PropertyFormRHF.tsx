import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MapPin, Home, Image as ImageIcon, Euro, ArrowLeft, ArrowRight, Check, Trash2, UploadCloud,
} from 'lucide-react';
import Dropzone from './ui/Dropzone';
import Button from './ui/Button';

const schema = z.object({
  title: z.string().min(5, 'El título debe ser descriptivo (min 5 letras)'),
  address: z.string().min(5, 'Dirección obligatoria'),
  region: z.string().min(2, 'Región obligatoria'),
  city: z.string().min(2, 'Ciudad obligatoria'),
  location: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
  sizeM2: z.coerce.number().min(10, 'Tamaño inválido (min 10m²)'),
  rooms: z.coerce.number().min(0, 'Habitaciones inválidas'),
  bathrooms: z.coerce.number().min(0, 'Baños inválidos'),
  furnished: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  images: z.array(z.string().url()).min(3, 'Sube al menos 3 fotos para publicar').max(20),
  price: z.coerce.number().min(100, 'Renta mínima 100€'),
  deposit: z.coerce.number().min(0, 'Depósito inválido'),
  availableFrom: z.string().min(2, 'Fecha requerida'),
  onlyTenantPro: z.boolean().optional().default(false),
  requiredTenantProMaxRent: z.coerce.number().min(0).optional().default(0),
});

export type PropertyFormData = z.infer<typeof schema>;

const STEPS = [
  { id: 'location', label: 'Ubicación', icon: <MapPin size={18} />, fields: ['title', 'address', 'city', 'region'] },
  { id: 'details', label: 'Detalles', icon: <Home size={18} />, fields: ['sizeM2', 'rooms', 'bathrooms'] },
  { id: 'photos', label: 'Galería', icon: <ImageIcon size={18} />, fields: ['images'] },
  { id: 'price', label: 'Condiciones', icon: <Euro size={18} />, fields: ['price', 'deposit', 'availableFrom'] },
];

type Props = {
  onSubmit: (data: PropertyFormData) => Promise<void> | void;
  defaultValues?: Partial<PropertyFormData>;
  onUploadPhotos: (files: File[]) => Promise<string[]>;
};

export default function PropertyFormRHF({ onSubmit, defaultValues, onUploadPhotos }: Props) {
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<PropertyFormData>({
    mode: 'onChange',
    resolver: zodResolver(schema) as any,
    defaultValues: {
      title: '',
      address: '',
      region: '',
      city: '',
      location: { lat: 40.4168, lng: -3.7038 },
      price: 0,
      deposit: 0,
      sizeM2: 60,
      rooms: 1,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date().toISOString().slice(0, 10),
      images: [],
      onlyTenantPro: false,
      requiredTenantProMaxRent: 0,
      ...defaultValues,
    },
  });

  const images = watch('images') || [];
  const onlyPro = watch('onlyTenantPro');
  const price = watch('price');
  const addressValue = watch('address');

  useEffect(() => {
    if (onlyPro) setValue('requiredTenantProMaxRent', Number(price) || 0);
    else setValue('requiredTenantProMaxRent', 0);
  }, [onlyPro, price, setValue]);

  useEffect(() => {
    const query = String(addressValue || '').trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsSearchingAddress(true);
        const params = new URLSearchParams({
          q: query,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'es' },
        });
        if (!res.ok) return;
        const data = await res.json();
        setAddressSuggestions(Array.isArray(data) ? data : []);
      } catch (error) {
        if ((error as any)?.name !== 'AbortError') {
          setAddressSuggestions([]);
        }
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [addressValue]);

  const applySuggestion = (suggestion: any) => {
    const address = suggestion?.display_name || '';
    const addr = suggestion?.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const region = addr.state || addr.region || addr.county || '';
    const lat = Number(suggestion?.lat);
    const lng = Number(suggestion?.lon);

    if (address) setValue('address', address, { shouldValidate: true });
    if (city) setValue('city', city, { shouldValidate: true });
    if (region) setValue('region', region, { shouldValidate: true });
    if (!Number.isNaN(lat)) setValue('location.lat', lat, { shouldValidate: true });
    if (!Number.isNaN(lng)) setValue('location.lng', lng, { shouldValidate: true });
    setAddressSuggestions([]);
  };

  const nextStep = async () => {
    const fieldsToValidate = STEPS[step].fields as any[];
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleDrop = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await onUploadPhotos(files);
      setValue('images', [...images, ...urls], { shouldValidate: true });
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="mb-6 px-1">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 rounded"></div>
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-600 scale-110'
                      : isDone
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? <Check size={20} /> : s.icon}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-1 py-2 space-y-6">
        {step === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título del anuncio</label>
              <input className="auth-input w-full" placeholder="Ej. Ático luminoso en el centro" {...register('title')} autoFocus />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección completa</label>
              <div className="relative">
                <input
                  className="auth-input w-full"
                  placeholder="Ej. Calle Mayor, 10, 3A"
                  {...register('address')}
                />
                {isSearchingAddress && (
                  <div className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</div>
                )}
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
                    {addressSuggestions.map((item) => (
                      <button
                        type="button"
                        key={item.place_id}
                        onClick={() => applySuggestion(item)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {item.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <input className="auth-input w-full" placeholder="Ej. Madrid" {...register('city')} />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Región / Provincia</label>
                <input className="auth-input w-full" placeholder="Ej. Comunidad de Madrid" {...register('region')} />
                {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region.message}</p>}
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-800 mb-3 font-medium">Coordenadas aproximadas (para el mapa)</p>
              <div className="grid grid-cols-2 gap-4">
                <input className="auth-input bg-white" type="number" step="any" placeholder="Latitud" {...register('location.lat', { valueAsNumber: true })} />
                <input className="auth-input bg-white" type="number" step="any" placeholder="Longitud" {...register('location.lng', { valueAsNumber: true })} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño</label>
                <div className="relative">
                  <input className="auth-input w-full pr-8" type="number" {...register('sizeM2', { valueAsNumber: true })} />
                  <span className="absolute right-3 top-2.5 text-gray-400 text-sm">m²</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habitaciones</label>
                <input className="auth-input w-full" type="number" {...register('rooms', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baños</label>
                <input className="auth-input w-full" type="number" {...register('bathrooms', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                <span className="font-medium text-gray-700">¿Está amueblado?</span>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" {...register('furnished')} />
              </label>
              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                <span className="font-medium text-gray-700">¿Admite mascotas?</span>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" {...register('petsAllowed')} />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Dropzone
              onFiles={handleDrop}
              className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors"
              style={{ padding: 24 }}
              label={
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UploadCloud size={24} />
                  </div>
                  <p className="font-medium text-gray-900">Haz clic o arrastra fotos aquí</p>
                  <p className="text-sm text-gray-500 mt-1">Sube al menos 3 imágenes de buena calidad</p>
                </div>
              }
            />

            {uploading && (
              <div className="text-center py-2 text-blue-600 animate-pulse text-sm font-medium">Subiendo imágenes...</div>
            )}

            {errors.images && <p className="text-red-500 text-sm text-center">{errors.images.message}</p>}

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {images.map((url, idx) => (
                  <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setValue('images', images.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                    {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1">Portada</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Mensual</label>
              <div className="relative">
                <input className="auth-input w-full pl-8 text-lg font-bold" type="number" {...register('price', { valueAsNumber: true })} placeholder="0" />
                <span className="absolute left-3 top-3 text-gray-500">€</span>
              </div>
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fianza / Depósito</label>
                <div className="relative">
                  <input className="auth-input w-full pl-8" type="number" {...register('deposit', { valueAsNumber: true })} />
                  <span className="absolute left-3 top-2.5 text-gray-500">€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disponible desde</label>
                <input className="auth-input w-full" type="date" {...register('availableFrom')} />
              </div>
            </div>

            <div className="border border-blue-100 rounded-xl overflow-hidden">
              <label className={`flex items-start gap-4 p-4 cursor-pointer transition-colors ${onlyPro ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                <input type="checkbox" className="mt-1 w-5 h-5 text-blue-600 rounded" {...register('onlyTenantPro')} />
                <div>
                  <span className="block font-bold text-gray-900">Solo inquilinos Tenant PRO</span>
                  <span className="text-sm text-gray-500">Exige perfil verificado y análisis de solvencia automático.</span>
                </div>
              </label>

              {onlyPro && (
                <div className="bg-blue-50/50 px-4 pb-4 pt-0 text-sm text-blue-800">
                  <div className="pl-9 space-y-1">
                    <p>ℹ️ Requisito de solvencia calculado: <strong>{Number(price || 0).toLocaleString()} €/mes</strong> (capacidad de pago).</p>
                    <p className="text-xs opacity-80">El inquilino deberá tener un límite de renta aprobado igual o superior a este precio.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </form>

      <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-auto">
        <Button
          variant="ghost"
          onClick={prevStep}
          disabled={step === 0}
          className="text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={18} className="mr-2" /> Atrás
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={nextStep} className="px-6">
            Siguiente <ArrowRight size={18} className="ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit(onSubmit)} className="px-8 bg-green-600 hover:bg-green-700 text-white">
            {(defaultValues as any)?._id ? 'Guardar Cambios' : 'Crear Propiedad'}
          </Button>
        )}
      </div>
    </div>
  );
}
