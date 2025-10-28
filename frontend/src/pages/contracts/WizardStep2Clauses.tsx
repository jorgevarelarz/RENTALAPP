import React, { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const SUPPLY_OPTIONS = ['agua', 'luz', 'gas', 'internet'] as const;
const GUARANTEE_OPTIONS = ['none', 'aval', 'seguroImpago'] as const;
const PENALTY_OPTIONS = ['none', '1monthPerYearPending'] as const;
const PET_OPTIONS = ['allowed', 'forbidden', 'conditional'] as const;
const PAYER_OPTIONS = ['landlord', 'tenant', 'shared'] as const;

type LandlordType = 'individual' | 'company';

const createSchema = (landlordType: LandlordType) =>
  z
    .object({
      furnished: z.boolean(),
      inventoryAttached: z.boolean(),
      pets: z.enum(PET_OPTIONS),
      petsConditions: z.string().optional(),
      subleaseAllowed: z.boolean(),
      durationMonths: z.number().int().positive(),
      automaticExtension: z.boolean(),
      depositExtra: z.number().min(0).max(2),
      guarantee: z.enum(GUARANTEE_OPTIONS),
      rentUpdateINE: z.boolean(),
      paymentBySEPA: z.boolean(),
      communityAndIBI: z.object({
        payer: z.enum(PAYER_OPTIONS),
        annualCost: z.number().optional(),
      }),
      supplies: z.array(
        z.object({
          supply: z.enum(SUPPLY_OPTIONS),
          payer: z.enum(PAYER_OPTIONS),
        }),
      ),
      minorWorksAllowed: z.boolean(),
      majorWorksWithAuth: z.boolean(),
      penalty: z.enum(PENALTY_OPTIONS),
      habitualUseOnly: z.boolean(),
      teleworkAllowed: z.boolean(),
      landlordInsurance: z.boolean(),
      tenantInsurance: z.boolean(),
      digitalInventory: z.boolean(),
      digitalNotifications: z.boolean(),
    })
    .superRefine((data, ctx) => {
      const minDuration = landlordType === 'company' ? 84 : 60;
      if (data.durationMonths < minDuration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['durationMonths'],
          message: `La duración mínima es de ${minDuration} meses para este tipo de arrendador`,
        });
      }
      if (!data.furnished && data.inventoryAttached) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inventoryAttached'],
          message: 'Solo puedes adjuntar inventario si el piso está amueblado',
        });
      }
      if (data.pets === 'conditional' && !data.petsConditions?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['petsConditions'],
          message: 'Describe las condiciones para las mascotas',
        });
      }
      if (data.communityAndIBI.payer === 'tenant') {
        const cost = data.communityAndIBI.annualCost ?? 0;
        if (cost <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['communityAndIBI', 'annualCost'],
            message: 'Indica el coste anual de referencia',
          });
        }
      }
      if (data.guarantee === 'seguroImpago') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guarantee'],
          message: 'El seguro de impago debe ser contratado por el arrendador (informativo, no vinculante).',
        });
      }
    });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

type Props = {
  landlordType: LandlordType;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  onNext: () => void;
  onBack: () => void;
};

const WizardStep2Clauses: React.FC<Props> = ({ landlordType, value, onChange, onNext, onBack }) => {
  const schema = useMemo(() => createSchema(landlordType ?? 'individual'), [landlordType]);
  const defaultValues: FormValues = useMemo(() => ({
    furnished: Boolean(value?.furnished ?? false),
    inventoryAttached: Boolean(value?.inventoryAttached ?? false),
    pets: (value?.pets as FormValues['pets']) ?? 'allowed',
    petsConditions: value?.petsConditions ?? '',
    subleaseAllowed: Boolean(value?.subleaseAllowed ?? false),
    durationMonths:
      typeof value?.durationMonths === 'number'
        ? value.durationMonths
        : landlordType === 'company'
        ? 84
        : 60,
    automaticExtension: Boolean(value?.automaticExtension ?? true),
    depositExtra: Number.isFinite(value?.depositExtra) ? Number(value.depositExtra) : 0,
    guarantee: (value?.guarantee as FormValues['guarantee']) ?? 'none',
    rentUpdateINE: Boolean(value?.rentUpdateINE ?? true),
    paymentBySEPA: Boolean(value?.paymentBySEPA ?? true),
    communityAndIBI: {
      payer: (value?.communityAndIBI?.payer as FormValues['communityAndIBI']['payer']) ?? 'landlord',
      annualCost: value?.communityAndIBI?.annualCost ? Number(value.communityAndIBI.annualCost) : undefined,
    },
    supplies: SUPPLY_OPTIONS.map((supply) => {
      const existing = Array.isArray(value?.supplies) ? value.supplies.find((item: any) => item.supply === supply) : undefined;
      return {
        supply,
        payer: (existing?.payer as FormValues['supplies'][number]['payer']) ?? 'tenant',
      };
    }),
    minorWorksAllowed: Boolean(value?.minorWorksAllowed ?? true),
    majorWorksWithAuth: Boolean(value?.majorWorksWithAuth ?? true),
    penalty: (value?.penalty as FormValues['penalty']) ?? 'none',
    habitualUseOnly: Boolean(value?.habitualUseOnly ?? true),
    teleworkAllowed: Boolean(value?.teleworkAllowed ?? true),
    landlordInsurance: Boolean(value?.landlordInsurance ?? true),
    tenantInsurance: Boolean(value?.tenantInsurance ?? false),
    digitalInventory: Boolean(value?.digitalInventory ?? true),
    digitalNotifications: Boolean(value?.digitalNotifications ?? true),
  }), [landlordType, value]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const furnished = watch('furnished');
  const pets = watch('pets');
  const communityPayer = watch('communityAndIBI.payer');

  const onSubmit = (data: FormValues) => {
    const cleaned = {
      ...data,
      petsConditions: data.pets === 'conditional' ? data.petsConditions?.trim() ?? '' : undefined,
      inventoryAttached: data.furnished ? data.inventoryAttached : false,
      communityAndIBI: {
        payer: data.communityAndIBI.payer,
        annualCost:
          data.communityAndIBI.payer === 'tenant' && Number.isFinite(data.communityAndIBI.annualCost)
            ? data.communityAndIBI.annualCost
            : undefined,
      },
      supplies: data.supplies,
      durationMonths: Number.isFinite(data.durationMonths) ? data.durationMonths : 0,
      depositExtra: Number.isFinite(data.depositExtra) ? data.depositExtra : 0,
    };
    onChange(cleaned as Record<string, any>);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
      <h2>Cláusulas opcionales</h2>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Amueblado</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('furnished')} />
          Se alquila amueblado
        </label>
        {furnished && (
          <label style={checkboxRow}>
            <input type="checkbox" {...register('inventoryAttached')} />
            Se adjunta inventario de muebles
          </label>
        )}
        {errors.inventoryAttached && <ErrorLabel>{errors.inventoryAttached.message}</ErrorLabel>}
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Mascotas</legend>
        {PET_OPTIONS.map(option => (
          <label key={option} style={radioRow}>
            <input type="radio" value={option} {...register('pets')} />
            {option === 'allowed' && 'Permitidas'}
            {option === 'forbidden' && 'Prohibidas'}
            {option === 'conditional' && 'Permitidas con condiciones'}
          </label>
        ))}
        {pets === 'conditional' && (
          <label style={{ display: 'grid', gap: 4 }}>
            Condiciones
            <textarea {...register('petsConditions')} rows={3} />
          </label>
        )}
        {errors.petsConditions && <ErrorLabel>{errors.petsConditions.message}</ErrorLabel>}
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Cesión y subarriendo</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('subleaseAllowed')} />
          Permitir subarriendo parcial (requiere consentimiento escrito)
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Duración y prórroga</legend>
        <label style={{ display: 'grid', gap: 4 }}>
          Duración pactada (meses)
          <input type="number" min={0} {...register('durationMonths', { valueAsNumber: true })} />
        </label>
        {errors.durationMonths && <ErrorLabel>{errors.durationMonths.message}</ErrorLabel>}
        <label style={checkboxRow}>
          <input type="checkbox" {...register('automaticExtension')} />
          Prórroga automática al terminar el plazo inicial
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Pagos y garantías</legend>
        <label style={{ display: 'grid', gap: 4 }}>
          Depósito adicional (máx. 2 meses)
          <input type="number" min={0} max={2} step={0.5} {...register('depositExtra', { valueAsNumber: true })} />
        </label>
        {errors.depositExtra && <ErrorLabel>{errors.depositExtra.message}</ErrorLabel>}
        <div style={{ display: 'grid', gap: 6 }}>
          Garantías:
          {GUARANTEE_OPTIONS.map(option => (
            <label key={option} style={radioRow}>
              <input type="radio" value={option} {...register('guarantee')} />
              {option === 'none' && 'Sin garantía extra'}
              {option === 'aval' && 'Aval bancario'}
              {option === 'seguroImpago' && 'Seguro de impago contratado por el arrendador'}
            </label>
          ))}
        </div>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('rentUpdateINE')} />
          Actualización anual de la renta según índice oficial del INE
        </label>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('paymentBySEPA')} />
          Pago obligatorio por domiciliación SEPA
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Gastos y suministros</legend>
        <label style={{ display: 'grid', gap: 4 }}>
          ¿Quién paga comunidad e IBI?
          <select {...register('communityAndIBI.payer')}>
            <option value="landlord">Propietario</option>
            <option value="tenant">Inquilino</option>
            <option value="shared">Compartido</option>
          </select>
        </label>
        {communityPayer === 'tenant' && (
          <label style={{ display: 'grid', gap: 4 }}>
            Coste anual de referencia (€)
            <input type="number" min={0} {...register('communityAndIBI.annualCost', { valueAsNumber: true })} />
          </label>
        )}
        {errors.communityAndIBI?.annualCost && <ErrorLabel>{errors.communityAndIBI.annualCost.message}</ErrorLabel>}
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0 }}>Suministros</p>
          {SUPPLY_OPTIONS.map((supply, index) => (
            <div key={supply} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="hidden" value={supply} {...register(`supplies.${index}.supply` as const)} />
              <span style={{ minWidth: 80, textTransform: 'capitalize' }}>{supply}</span>
              <Controller
                control={control}
                name={`supplies.${index}.payer`}
                render={({ field }) => (
                  <select {...field}>
                    <option value="landlord">Propietario</option>
                    <option value="tenant">Inquilino</option>
                    <option value="shared">Compartido</option>
                  </select>
                )}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Obras y modificaciones</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('minorWorksAllowed')} />
          Permitir obras menores (pintar, colgar cuadros)
        </label>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('majorWorksWithAuth')} />
          Obras mayores solo con autorización escrita del propietario
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Resolución anticipada</legend>
        {PENALTY_OPTIONS.map(option => (
          <label key={option} style={radioRow}>
            <input type="radio" value={option} {...register('penalty')} />
            {option === 'none' ? 'Sin penalización' : '1 mes por año restante (LAU, art. 11)'}
          </label>
        ))}
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Uso de la vivienda</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('habitualUseOnly')} />
          Solo vivienda habitual
        </label>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('teleworkAllowed')} />
          Se permite teletrabajo sin atención al público
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Seguros</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('landlordInsurance')} />
          El arrendador tendrá seguro continente
        </label>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('tenantInsurance')} />
          El inquilino tendrá seguro de contenido (opcional)
        </label>
      </fieldset>

      <fieldset style={sectionStyle}>
        <legend style={legendStyle}>Extras tecnológicos</legend>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('digitalInventory')} />
          Adjuntar inventario digital con fotos
        </label>
        <label style={checkboxRow}>
          <input type="checkbox" {...register('digitalNotifications')} />
          Aceptar notificaciones electrónicas (email/app)
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onBack} style={ghostButton}>Atrás</button>
        <button type="submit" style={primaryButton}>Siguiente</button>
      </div>
    </form>
  );
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  padding: 20,
  display: 'grid',
  gap: 12,
  background: '#fff',
};

const legendStyle: React.CSSProperties = {
  fontWeight: 600,
  marginBottom: 8,
};

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const primaryButton: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 12,
  border: '1px solid #cbd5f5',
  background: 'transparent',
  color: '#111827',
  cursor: 'pointer',
};

const ErrorLabel: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span style={{ color: '#991b1b', fontSize: 12 }}>{children}</span>
);

export default WizardStep2Clauses;
