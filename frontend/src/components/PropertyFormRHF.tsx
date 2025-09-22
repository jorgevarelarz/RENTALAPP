import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  title: z.string().min(3, 'Título obligatorio'),
  address: z.string().min(5, 'Dirección obligatoria'),
  region: z.string().min(2, 'Región obligatoria'),
  city: z.string().min(2, 'Ciudad obligatoria'),
  location: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
  price: z.coerce.number().min(1, 'Renta inválida'),
  deposit: z.coerce.number().min(0, 'Depósito inválido'),
  sizeM2: z.coerce.number().min(1, 'Tamaño inválido'),
  rooms: z.coerce.number().min(0, 'Habitaciones inválidas'),
  bathrooms: z.coerce.number().min(0, 'Baños inválidos'),
  furnished: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  availableFrom: z.string().min(2, 'Fecha requerida'),
  images: z.array(z.string().url()).max(20).optional().default([]),
  onlyTenantPro: z.boolean().optional().default(false),
  requiredTenantProMaxRent: z.coerce.number().min(0).optional().default(0),
});

export type PropertyFormData = z.infer<typeof schema>;

export default function PropertyFormRHF({
  onSubmit,
  defaultValues,
  uploading,
}: {
  onSubmit: (data: PropertyFormData) => Promise<void> | void;
  defaultValues?: Partial<PropertyFormData>;
  uploading?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<any>({
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
      sizeM2: 50,
      rooms: 1,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date().toISOString().slice(0,10),
      images: [],
      onlyTenantPro: false,
      requiredTenantProMaxRent: 0,
      ...defaultValues,
    },
  });

  const onlyPro = watch('onlyTenantPro');
  const price = watch('price');

  useEffect(() => {
    const p = Number(price || 0);
    if (onlyPro) setValue('requiredTenantProMaxRent', p || 0, { shouldValidate: false });
    else setValue('requiredTenantProMaxRent', 0, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyPro, price, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <label>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Título</div>
        <input className="auth-input" placeholder="Piso céntrico" {...register('title')} />
        {errors.title && (
          <div style={{ color: 'red', fontSize: 12 }}>{String((errors.title as any).message || '')}</div>
        )}
      </label>
      <label>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Dirección</div>
        <input className="auth-input" placeholder="Calle…" {...register('address')} />
        {errors.address && (
          <div style={{ color: 'red', fontSize: 12 }}>{String((errors.address as any).message || '')}</div>
        )}
      </label>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Región</div>
          <input className="auth-input" placeholder="madrid" {...register('region')} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Ciudad</div>
          <input className="auth-input" placeholder="Madrid" {...register('city')} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Latitud</div>
          <input className="auth-input" type="number" step="any" {...register('location.lat', { valueAsNumber: true })} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Longitud</div>
          <input className="auth-input" type="number" step="any" {...register('location.lng', { valueAsNumber: true })} />
        </label>
      </div>
      <label>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Renta (EUR)</div>
        <input className="auth-input" type="number" step="1" min="0" {...register('price', { valueAsNumber: true })} />
        {errors.price && (
          <div style={{ color: 'red', fontSize: 12 }}>{String((errors.price as any).message || '')}</div>
        )}
      </label>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Depósito (EUR)</div>
          <input className="auth-input" type="number" step="1" min="0" {...register('deposit', { valueAsNumber: true })} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Tamaño (m²)</div>
          <input className="auth-input" type="number" step="1" min="1" {...register('sizeM2', { valueAsNumber: true })} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Habitaciones</div>
          <input className="auth-input" type="number" step="1" min="0" {...register('rooms', { valueAsNumber: true })} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Baños</div>
          <input className="auth-input" type="number" step="1" min="0" {...register('bathrooms', { valueAsNumber: true })} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" {...register('furnished')} /> Amueblado
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" {...register('petsAllowed')} /> Mascotas
        </label>
      </div>
      <label>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Disponible desde</div>
        <input className="auth-input" type="date" {...register('availableFrom')} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" {...register('onlyTenantPro')} /> Solo inquilinos PRO
      </label>
      {/* Validación mínima se fija automáticamente al precio en el backend; no editable aquí */}
      {onlyPro && (
        <div style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Requisito orientativo de ingresos (seguro de impago)</div>
          {(() => {
            const p = Number(watch('price') ?? 0);
            if (!p || isNaN(p)) return <div>Introduce la renta para calcular.</div>;
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
          <div style={{ marginTop: 6, color: '#6B7280' }}>El candidato PRO debe tener una validación (maxRent) ≥ la renta de este anuncio. Estos importes son orientativos para estimar ingresos necesarios.</div>
        </div>
      )}
      {uploading && <div style={{ fontSize: 12 }}>Subiendo imágenes…</div>}
      <button type="submit" className="auth-button">Guardar</button>
    </form>
  );
}
