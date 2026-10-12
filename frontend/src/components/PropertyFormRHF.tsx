import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MapPin, Home, Image as ImageIcon, Euro, ArrowLeft, ArrowRight, Check, X, UploadCloud, Sparkles,
} from 'lucide-react';
import type { FieldErrors } from 'react-hook-form';
import Dropzone from './ui/Dropzone';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import RentSuggestionCard from './RentSuggestionCard';
import { generateDescription } from '../services/ai';
import { useToast } from '../context/ToastContext';

// Un campo numérico vacío llega como NaN (valueAsNumber); sin mensaje propio, zod diría «Expected number, received nan»
const num = (message: string) => z.coerce.number({ invalid_type_error: message, required_error: message });

const schema = z.object({
  title: z.string().min(5, 'El título necesita al menos 5 caracteres'),
  address: z.string().min(5, 'Escribe la dirección'),
  description: z.string().max(1200, 'La descripción admite hasta 1200 caracteres').optional().default(''),
  region: z.string().min(2, 'Escribe la región o provincia'),
  city: z.string().min(2, 'Escribe la ciudad'),
  location: z.object({
    lat: num('Escribe la latitud').min(-90, 'La latitud va de -90 a 90').max(90, 'La latitud va de -90 a 90'),
    lng: num('Escribe la longitud').min(-180, 'La longitud va de -180 a 180').max(180, 'La longitud va de -180 a 180'),
  }),
  sizeM2: num('Escribe el tamaño').min(10, 'El tamaño mínimo es 10 m²'),
  rooms: num('Escribe las habitaciones').min(0, 'Revisa las habitaciones'),
  bathrooms: num('Escribe los baños').min(0, 'Revisa los baños'),
  furnished: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  condition: z.enum(['obra_nueva', 'reformado', 'buen_estado', 'a_reformar']).default('buen_estado'),
  floor: num('Revisa la planta').min(0, 'Revisa la planta').max(60, 'Revisa la planta').optional(),
  hasElevator: z.boolean().optional(),
  yearBuilt: num('Revisa el año')
    .min(1800, 'Revisa el año')
    .max(new Date().getFullYear() + 2, 'Revisa el año')
    .optional(),
  images: z.array(z.string().url()).min(3, 'Sube al menos 3 fotos para publicar').max(20, 'Caben 20 fotos como máximo'),
  price: num('Escribe la renta mensual').min(100, 'La renta mínima es 100 €'),
  deposit: num('Escribe la fianza (0 si no hay)').min(0, 'Revisa la fianza'),
  availableFrom: z.string().min(2, 'Elige la fecha'),
  onlyTenantPro: z.boolean().optional().default(false),
  requiredTenantProMaxRent: z.coerce.number().min(0).optional().default(0),
});

export type PropertyFormData = z.infer<typeof schema>;

// fields: lo que se valida al pulsar «Siguiente» y a qué paso se vuelve si falla al enviar
const STEPS = [
  { id: 'location', label: 'Ubicación', icon: <MapPin size={18} />, fields: ['title', 'address', 'city', 'region', 'location'] },
  { id: 'details', label: 'Detalles', icon: <Home size={18} />, fields: ['sizeM2', 'rooms', 'bathrooms', 'condition', 'floor', 'yearBuilt'] },
  { id: 'photos', label: 'Galería', icon: <ImageIcon size={18} />, fields: ['images'] },
  { id: 'price', label: 'Condiciones', icon: <Euro size={18} />, fields: ['price', 'description', 'deposit', 'availableFrom'] },
];

/** Mensaje de error bajo un campo, enlazado con aria-describedby */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="ra-field-error">{message}</p>;
}

/** Campo numérico con una unidad dentro (€, m²); la unidad queda fuera de la etiqueta */
const AffixInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  affix: string;
  affixSide: 'left' | 'right';
}>(({ label, affix, affixSide, className, id, ...rest }, ref) => {
  const autoId = React.useId();
  const inputId = id || autoId;
  return (
    <div className="ra-field">
      <label htmlFor={inputId} className="ra-field-label">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          {...rest}
          className={['ra-input', affixSide === 'left' ? 'pl-9' : 'pr-12', className].filter(Boolean).join(' ')}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 flex items-center text-sm text-[var(--ra-muted)] ${
            affixSide === 'left' ? 'left-3.5' : 'right-3.5'
          }`}
        >
          {affix}
        </span>
      </div>
    </div>
  );
});
AffixInput.displayName = 'AffixInput';

type Props = {
  onSubmit: (data: PropertyFormData) => Promise<void> | void;
  defaultValues?: Partial<PropertyFormData>;
  onUploadPhotos: (files: File[]) => Promise<string[]>;
};

export default function PropertyFormRHF({ onSubmit, defaultValues, onUploadPhotos }: Props) {
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  // Dirección ya confirmada (sugerencia elegida o la guardada al editar): no se busca, la lista se abriría sola
  const pickedAddress = useRef<string | null>(String(defaultValues?.address || '').trim() || null);
  const { push } = useToast();

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
      description: '',
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
      condition: 'buen_estado',
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
  const title = watch('title');
  const city = watch('city');
  const sizeM2 = watch('sizeM2');
  const rooms = watch('rooms');
  const bathrooms = watch('bathrooms');
  const furnished = watch('furnished');
  const petsAllowed = watch('petsAllowed');
  const region = watch('region');
  const condition = watch('condition');
  const floor = watch('floor');
  const hasElevator = watch('hasElevator');
  const yearBuilt = watch('yearBuilt');
  const locationLat = watch('location.lat');
  const locationLng = watch('location.lng');
  const addressQuery = String(addressValue || '').trim();
  const imageCount = images.length;
  const publishReadiness = {
    hasMinPhotos: imageCount >= 3,
    hasPrice: Number(price || 0) >= 100,
    hasAddress: Boolean(addressValue && city && region),
  };
  const isPublishReady = publishReadiness.hasMinPhotos && publishReadiness.hasPrice && publishReadiness.hasAddress;

  useEffect(() => {
    if (onlyPro) setValue('requiredTenantProMaxRent', Number(price) || 0);
    else setValue('requiredTenantProMaxRent', 0);
  }, [onlyPro, price, setValue]);

  useEffect(() => {
    const query = String(addressValue || '').trim();
    if (query.length < 4 || query === pickedAddress.current) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }
    pickedAddress.current = null;

    // «Buscando…» desde que se escribe, para que la pista de «no aparece» no salga durante la espera
    setIsSearchingAddress(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
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
        if (!controller.signal.aborted) setIsSearchingAddress(false);
      }
    }, 1000); // Nominatim admite como mucho 1 petición por segundo

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

    pickedAddress.current = address.trim() || null;
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

  // Al enviar con errores en un paso anterior (p. ej. la planta), volver a ese paso para que se vean
  const onInvalid = (errs: FieldErrors<PropertyFormData>) => {
    const failing = STEPS.findIndex(st => st.fields.some(f => (errs as any)[f]));
    if (failing >= 0 && failing !== step) setStep(failing);
    push({ title: 'Revisa los datos marcados antes de guardar.', tone: 'error' });
  };

  // Intro dentro de un campo avanza de paso; solo en el último guarda
  const handleFormSubmit = (e: React.FormEvent) => {
    if (step < STEPS.length - 1) {
      e.preventDefault();
      void nextStep();
      return;
    }
    void handleSubmit(onSubmit, onInvalid)(e);
  };

  const err = (name: string) => {
    const e = name.split('.').reduce<any>((acc, k) => acc?.[k], errors);
    return e?.message as string | undefined;
  };
  const a11y = (name: string) => {
    const invalid = Boolean(err(name));
    return {
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? `pf-${name.replace('.', '-')}-error` : undefined,
    };
  };
  const errorFor = (name: string) => <FieldError id={`pf-${name.replace('.', '-')}-error`} message={err(name)} />;

  const handleDrop = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const urls = await onUploadPhotos(files);
      setValue('images', [...images, ...urls], { shouldValidate: true });
    } catch (e) {
      const message = 'No se pudieron subir las fotos. Prueba de nuevo o guarda el borrador.';
      setUploadError(message);
      push({ title: message, tone: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateDescription = async () => {
    setDescriptionError('');
    setGeneratingDescription(true);
    try {
      const features = [
        `${Number(sizeM2 || 0)} m²`,
        `${Number(rooms || 0)} habitaciones`,
        `${Number(bathrooms || 0)} baños`,
        furnished ? 'amueblado' : 'sin amueblar',
        petsAllowed ? 'admite mascotas' : 'no admite mascotas',
      ];
      const { description } = await generateDescription({
        title: title || 'Vivienda en alquiler',
        city: city || 'España',
        rent: Number(price || 0),
        features,
        tone: 'friendly',
        language: 'es',
        maxWords: 120,
      });
      setValue('description', description, { shouldValidate: true, shouldDirty: true });
    } catch (error: any) {
      setDescriptionError(error?.response?.data?.error || error?.response?.data?.message || 'No se pudo generar la descripción');
    } finally {
      setGeneratingDescription(false);
    }
  };


  const checkboxClass = 'h-5 w-5 shrink-0 rounded accent-[var(--ra-blue)]';
  const toggleRowClass =
    'flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--ra-line)] bg-white px-4 py-3.5 transition-colors hover:bg-[var(--ra-paper)]';

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <ol className="mb-6 grid grid-cols-4 gap-2 px-1" aria-label="Pasos del anuncio">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <li key={s.id} aria-current={isActive ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
              <span
                aria-hidden="true"
                className={`h-1 rounded-full ${isActive || isDone ? 'bg-[var(--ra-blue)]' : 'bg-[var(--ra-line)]'}`}
              />
              <span
                className={`flex items-center gap-1.5 truncate text-xs font-semibold ${
                  isActive ? 'text-[var(--ra-ink)]' : 'text-[var(--ra-muted)]'
                }`}
              >
                <span aria-hidden="true" className={isActive || isDone ? 'text-[var(--ra-blue)]' : ''}>
                  {isDone ? <Check size={14} /> : React.cloneElement(s.icon, { size: 14 })}
                </span>
                {/* En móvil no caben las cuatro etiquetas: solo la del paso activo */}
                <span className={isActive ? 'truncate' : 'sr-only sm:not-sr-only sm:truncate'}>{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleFormSubmit} noValidate className="flex-1 overflow-y-auto px-1 py-2 space-y-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid gap-1.5">
              <Input
                label="Título del anuncio"
                placeholder="Ej. Ático luminoso en el centro"
                autoFocus
                {...a11y('title')}
                {...register('title')}
              />
              {errorFor('title')}
            </div>

            <div className="grid gap-1.5">
              <div className="relative">
                <Input
                  label="Dirección completa"
                  placeholder="Ej. Calle Mayor, 10, 3.º A"
                  autoComplete="off"
                  {...a11y('address')}
                  {...register('address')}
                />
                {isSearchingAddress && (
                  <span className="pointer-events-none absolute bottom-3 right-3.5 text-xs text-[var(--ra-muted)]">Buscando…</span>
                )}
                {addressSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[var(--ra-line)] bg-white py-1 shadow-lg">
                    {addressSuggestions.map((item) => (
                      <li key={item.place_id}>
                        <button
                          type="button"
                          onClick={() => applySuggestion(item)}
                          className="w-full px-3.5 py-2.5 text-left text-sm text-[var(--ra-ink)] hover:bg-[var(--ra-paper)]"
                        >
                          {item.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!isSearchingAddress && addressQuery.length >= 4 && addressQuery !== pickedAddress.current && addressSuggestions.length === 0 && (
                <p className="ra-field-hint">
                  Si no aparece la dirección, sigue con la que has escrito y completa ciudad, región y coordenadas.
                </p>
              )}
              {errorFor('address')}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Input label="Ciudad" placeholder="Ej. Madrid" {...a11y('city')} {...register('city')} />
                {errorFor('city')}
              </div>
              <div className="grid gap-1.5">
                <Input label="Región o provincia" placeholder="Ej. Comunidad de Madrid" {...a11y('region')} {...register('region')} />
                {errorFor('region')}
              </div>
            </div>

            <fieldset className="grid gap-3 rounded-xl bg-[var(--ra-paper)] p-4">
              <legend className="sr-only">Coordenadas</legend>
              <div>
                <p className="ra-field-label">Coordenadas para el mapa</p>
                <p className="ra-field-hint mt-0.5">Se rellenan solas al elegir una dirección sugerida.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Input label="Latitud" type="number" step="any" inputMode="decimal" {...a11y('location.lat')} {...register('location.lat', { valueAsNumber: true })} />
                  {errorFor('location.lat')}
                </div>
                <div className="grid gap-1.5">
                  <Input label="Longitud" type="number" step="any" inputMode="decimal" {...a11y('location.lng')} {...register('location.lng', { valueAsNumber: true })} />
                  {errorFor('location.lng')}
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="grid content-start gap-1.5">
                <AffixInput label="Tamaño" affix="m²" affixSide="right" type="number" min={0} inputMode="numeric" {...a11y('sizeM2')} {...register('sizeM2', { valueAsNumber: true })} />
                {errorFor('sizeM2')}
              </div>
              <div className="grid content-start gap-1.5">
                <Input label="Habitaciones" type="number" min={0} inputMode="numeric" {...a11y('rooms')} {...register('rooms', { valueAsNumber: true })} />
                {errorFor('rooms')}
              </div>
              <div className="grid content-start gap-1.5">
                <Input label="Baños" type="number" min={0} inputMode="numeric" {...a11y('bathrooms')} {...register('bathrooms', { valueAsNumber: true })} />
                {errorFor('bathrooms')}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Select label="Estado de la vivienda" aria-describedby="pf-condition-help" {...register('condition')}>
                <option value="obra_nueva">Obra nueva</option>
                <option value="reformado">Reformado</option>
                <option value="buen_estado">Buen estado</option>
                <option value="a_reformar">A reformar</option>
              </Select>
              <p id="pf-condition-help" className="ra-field-hint">
                Se usa para ajustar el precio sugerido al estado real de la vivienda.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="grid content-start gap-1.5">
                <Input
                  label="Planta"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Opcional"
                  {...a11y('floor')}
                  {...register('floor', { setValueAs: v => (v === '' ? undefined : Number(v)) })}
                />
                {errorFor('floor')}
              </div>
              <div className="grid content-start gap-1.5">
                <Input
                  label="Año de construcción"
                  type="number"
                  inputMode="numeric"
                  placeholder="Opcional"
                  {...a11y('yearBuilt')}
                  {...register('yearBuilt', { setValueAs: v => (v === '' ? undefined : Number(v)) })}
                />
                {errorFor('yearBuilt')}
              </div>
            </div>

            <div className="space-y-2">
              <label className={toggleRowClass}>
                <span className="text-sm font-medium text-[var(--ra-ink)]">Tiene ascensor</span>
                <input type="checkbox" className={checkboxClass} {...register('hasElevator')} />
              </label>
              <label className={toggleRowClass}>
                <span className="text-sm font-medium text-[var(--ra-ink)]">Está amueblado</span>
                <input type="checkbox" className={checkboxClass} {...register('furnished')} />
              </label>
              <label className={toggleRowClass}>
                <span className="text-sm font-medium text-[var(--ra-ink)]">Admite mascotas</span>
                <input type="checkbox" className={checkboxClass} {...register('petsAllowed')} />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm ${
                imageCount >= 3 ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <p className="font-semibold">
                {imageCount >= 3
                  ? 'Galería lista para publicar'
                  : `Faltan ${Math.max(3 - imageCount, 0)} ${3 - imageCount === 1 ? 'foto' : 'fotos'} para publicar`}
              </p>
              <p className="mt-0.5">Hacen falta al menos 3. La primera es la portada del anuncio.</p>
            </div>
            <Dropzone
              onFiles={handleDrop}
              className="rounded-xl border border-dashed border-[rgba(11,16,37,.24)] bg-[var(--ra-paper)] transition-colors hover:border-[var(--ra-blue)]"
              style={{ padding: 24 }}
              label={
                <div className="text-center">
                  <UploadCloud size={28} className="mx-auto mb-2 text-[var(--ra-blue)]" aria-hidden="true" />
                  <p className="font-semibold text-[var(--ra-ink)]">Haz clic o arrastra las fotos aquí</p>
                  <p className="mt-1 text-sm text-[var(--ra-muted)]">JPG, PNG o WebP, con buena luz y en horizontal</p>
                </div>
              }
            />

            {uploading && (
              <p role="status" className="text-center text-sm font-medium text-[var(--ra-muted)]">Subiendo fotos…</p>
            )}
            {uploadError && <p role="alert" className="ra-field-error text-center">{uploadError}</p>}

            {images.length > 0 && (
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                {images.map((url, idx) => (
                  <li key={url} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--ra-line)] bg-[var(--ra-paper)]">
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setValue('images', images.filter((_, i) => i !== idx), { shouldValidate: true })}
                      aria-label={`Quitar la foto ${idx + 1}`}
                      className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[var(--ra-ink)] shadow-sm hover:bg-white"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[var(--ra-ink)]">
                        Portada
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <RentSuggestionCard
              input={{
                region: String(region || ''),
                city: String(city || ''),
                sizeM2: Number(sizeM2) || 0,
                location:
                  Number.isFinite(Number(locationLat)) && Number.isFinite(Number(locationLng))
                    ? { lat: Number(locationLat), lng: Number(locationLng) }
                    : undefined,
                condition,
                furnished,
                floor: Number.isFinite(Number(floor)) ? Number(floor) : undefined,
                hasElevator,
                yearBuilt: Number.isFinite(Number(yearBuilt)) ? Number(yearBuilt) : undefined,
                propertyId: (defaultValues as any)?._id,
              }}
              onApply={value => setValue('price', value, { shouldValidate: true, shouldDirty: true })}
            />

            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                isPublishReady ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <p className="font-semibold">
                {isPublishReady
                  ? 'Anuncio listo para publicar'
                  : publishReadiness.hasMinPhotos
                  ? 'Puedes publicar, pero revisa estos datos'
                  : 'Faltan fotos para poder publicar'}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <li>Fotos: {imageCount} de 3</li>
                <li>{publishReadiness.hasPrice ? 'Precio correcto' : 'Falta un precio válido'}</li>
                <li>{publishReadiness.hasAddress ? 'Ubicación completa' : 'Falta la dirección, la ciudad o la región'}</li>
              </ul>
            </div>

            <div className="grid gap-1.5">
              <AffixInput
                label="Renta mensual"
                affix="€"
                affixSide="left"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                className="text-lg font-semibold"
                {...a11y('price')}
                {...register('price', { valueAsNumber: true })}
              />
              {errorFor('price')}
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="pf-description" className="ra-field-label">Descripción del anuncio</label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={generatingDescription}
                >
                  <Sparkles size={15} aria-hidden="true" />
                  {generatingDescription ? 'Generando…' : 'Generar con IA'}
                </Button>
              </div>
              <textarea
                id="pf-description"
                className="ra-input min-h-[130px] resize-y"
                placeholder="Describe la vivienda, sus puntos fuertes y el tipo de inquilino ideal."
                {...a11y('description')}
                {...register('description')}
              />
              {errorFor('description')}
              {descriptionError && <p className="ra-field-error">{descriptionError}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <AffixInput
                  label="Fianza"
                  affix="€"
                  affixSide="left"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...a11y('deposit')}
                  {...register('deposit', { valueAsNumber: true })}
                />
                {errorFor('deposit')}
              </div>
              <div className="grid content-start gap-1.5">
                <Input label="Disponible desde" type="date" {...a11y('availableFrom')} {...register('availableFrom')} />
                {errorFor('availableFrom')}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--ra-line)]">
              <label className={`flex cursor-pointer items-start gap-3 p-4 transition-colors ${onlyPro ? 'bg-[var(--ra-paper)]' : 'bg-white hover:bg-[var(--ra-paper)]'}`}>
                <input type="checkbox" className={`mt-0.5 ${checkboxClass}`} {...register('onlyTenantPro')} />
                <span>
                  <span className="block text-sm font-semibold text-[var(--ra-ink)]">Solo inquilinos Tenant PRO</span>
                  <span className="block text-sm text-[var(--ra-muted)]">Exige perfil verificado y análisis de solvencia.</span>
                </span>
              </label>

              {onlyPro && (
                <div className="bg-[var(--ra-paper)] px-4 pb-4 pl-12 text-sm text-[var(--ra-ink)]">
                  <p>
                    Solvencia exigida: <strong>{Number(price || 0).toLocaleString('es-ES')} €/mes</strong>.
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ra-muted)]">
                    El inquilino necesita un límite de renta aprobado igual o superior a este precio.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </form>

      <div className="mt-auto flex items-center justify-between border-t border-[var(--ra-line)] pt-4">
        <Button variant="ghost" onClick={prevStep} disabled={step === 0}>
          <ArrowLeft size={18} aria-hidden="true" /> Atrás
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={nextStep} className="px-6">
            Siguiente <ArrowRight size={18} aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={handleSubmit(onSubmit, onInvalid)} className="px-8">
            {(defaultValues as any)?._id ? 'Guardar cambios' : 'Crear anuncio'}
          </Button>
        )}
      </div>
    </div>
  );
}
