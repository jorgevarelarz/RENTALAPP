import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import ChangePasswordCard from './ChangePasswordCard';
import { useToast } from '../../context/ToastContext';
import { userService, UserProfile } from '../../services/user';
import { toAbsoluteUrl } from '../../utils/media';

const RatingStars = ({ rating }: { rating: number }) => (
  <div className="flex items-center text-yellow-400">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        aria-hidden="true"
        className={`w-4 h-4 ${i < Math.round(rating) ? 'fill-current' : 'text-gray-300'}`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
    <span className="ml-2 text-gray-900 text-sm font-semibold">{rating.toFixed(1)}</span>
  </div>
);

const SERVICE_LABELS: Record<string, string> = {
  fontaneria: 'Fontanería',
  electricidad: 'Electricidad',
  albanileria: 'Albañilería y pladur',
  carpinteria: 'Carpintería',
  pintura: 'Pintura',
  limpieza: 'Limpieza',
  jardineria: 'Jardinería',
  inmobiliaria: 'Agente inmobiliario',
  cerrajeria: 'Cerrajería',
  otros: 'Otros servicios',
};

const roleLabel = (role: string, serviceCategory: string) => {
  if (role === 'pro') return SERVICE_LABELS[serviceCategory] || 'Profesional';
  if (role === 'tenant') return 'Inquilino';
  if (role === 'landlord') return 'Propietario';
  if (role === 'agency') return 'Agencia';
  return 'Administrador';
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { push } = useToast();
  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bio: '',
    jobTitle: '',
    monthlyIncome: '',
    companyName: '',
    serviceCategory: 'general',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await userService.getProfile();
        setProfile(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          jobTitle: data.jobTitle || '',
          monthlyIncome: data.monthlyIncome ? String(data.monthlyIncome) : '',
          companyName: data.companyName || '',
          serviceCategory: data.serviceCategory || 'general',
        });
      } catch (error) {
        push({ title: 'No se pudo cargar tu perfil', tone: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [push]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPhone = formData.phone.replace(/\s/g, '');
    const phoneRegex = /^(\+34|0034|34)?[6789]\d{8}$/;
    if (rawPhone && !phoneRegex.test(rawPhone)) {
      push({ title: 'Formato de teléfono no válido (ej.: 600123456)', tone: 'error' });
      return;
    }
    if (formData.bio && formData.bio.length > 500) {
      push({ title: 'El texto «Sobre ti» no puede superar 500 caracteres', tone: 'error' });
      return;
    }
    if (profile?.role === 'tenant' && formData.monthlyIncome) {
      const income = Number(formData.monthlyIncome);
      if (!Number.isFinite(income) || income < 0) {
        push({ title: 'Los ingresos deben ser un número positivo', tone: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = { ...formData };
      delete payload.name;
      if (formData.monthlyIncome !== '') {
        payload.monthlyIncome = Number(formData.monthlyIncome);
      } else {
        payload.monthlyIncome = undefined;
      }
      const updated = await userService.updateProfile(payload);
      setProfile(updated);
      push({ title: 'Perfil actualizado correctamente', tone: 'success' });
    } catch (error) {
      push({ title: 'No se pudieron guardar los cambios', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const form = new FormData();
    form.append('files', file);
    setUploading(true);
    try {
      const res = await userService.uploadAvatar(form);
      const url = res.url;
      if (url) {
        const updated = await userService.updateProfile({ avatar: url });
        setProfile(updated);
        push({ title: 'Foto actualizada', tone: 'success' });
      } else {
        push({ title: 'No se pudo subir la imagen', tone: 'error' });
      }
    } catch (error) {
      push({ title: 'No se pudo subir la foto', tone: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!profile) return <div>No se encontró el usuario.</div>;
  // /api/users/me responde también a quien aún no ha verificado y trae el estado al día.
  const verified = profile.isVerified ?? Boolean(user?.isVerified);
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : '';
  const rating = typeof profile.ratingAvg === 'number' ? profile.ratingAvg : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden ring-1 ring-[var(--ra-line)]">
              {profile.avatar ? (
                <img src={toAbsoluteUrl(profile.avatar)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-3xl font-bold text-gray-400">
                  {profile.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer text-white text-sm font-medium"
              disabled={uploading}
            >
              {uploading ? 'Subiendo…' : 'Cambiar foto'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.role === 'pro' && formData.companyName ? formData.companyName : formData.name}
                </h1>
                <p className="mt-1 text-sm text-gray-600 [overflow-wrap:anywhere]">
                  {profile.role === 'pro' && formData.companyName && <>{formData.name} · </>}
                  {roleLabel(profile.role, formData.serviceCategory)}
                  {verified ? (
                    <span className="font-medium text-emerald-700"> · Identidad verificada</span>
                  ) : (
                    <>
                      {' · Identidad sin verificar'}
                      {profile.role === 'tenant' && (
                        <>
                          {' · '}
                          <Link to="/tenant/kyc" className="font-medium text-[var(--ra-blue)] hover:underline">
                            Verificarla
                          </Link>
                        </>
                      )}
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-500 mt-0.5 [overflow-wrap:anywhere]">{profile.email}</p>
                {isTenantPro && (
                  <div className="mt-3">
                    <ProBadge maxRent={user?.tenantPro?.maxRent} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Tu reputación</h3>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm text-gray-600">Puntuación media</span>
              {rating ? <RatingStars rating={rating} /> : <span className="text-sm text-gray-500">Aún sin valoraciones</span>}
            </div>
            {memberSince && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Miembro desde</span>
                <span className="text-sm font-semibold text-gray-900">{memberSince}</span>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {profile.role === 'tenant' && 'Un perfil completo mejora tu visibilidad en solicitudes.'}
                {profile.role === 'landlord' && 'Los inquilinos prefieren propietarios con identidad verificada.'}
                {profile.role === 'pro' && 'Detalla tus servicios para aparecer en más búsquedas.'}
              </p>
            </div>
          </Card>

          <ChangePasswordCard />
        </div>

        <div className="lg:col-span-2">
          <Card className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Tus datos</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Nombre"
                  name="name"
                  value={formData.name}
                  disabled
                />
                <Input
                  label="Teléfono"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <Input
                label="Correo electrónico"
                type="email"
                value={profile.email}
                disabled
              />
              <span className="text-xs text-gray-400">El correo no se puede cambiar.</span>

              {profile.role === 'tenant' && (
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h3 className="font-semibold text-gray-900">Datos de solvencia</h3>
                  <p className="text-sm text-gray-500 -mt-2">
                    Solo visible para propietarios tras enviar una solicitud.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Profesión o cargo"
                      name="jobTitle"
                      value={formData.jobTitle}
                      onChange={handleChange}
                      placeholder="Ej.: Desarrolladora"
                    />
                    <Input
                      label="Ingresos mensuales (€)"
                      name="monthlyIncome"
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={handleChange}
                      placeholder="Ej.: 2000"
                    />
                  </div>
                </div>
              )}

              {profile.role === 'pro' && (
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h3 className="font-semibold text-gray-900">Perfil profesional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Nombre de empresa"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      placeholder="Ej.: Reformas García"
                    />
                    <Select
                      label="Especialidad principal"
                      name="serviceCategory"
                      value={formData.serviceCategory}
                      onChange={handleChange}
                    >
                      <option value="general">Mantenimiento general</option>
                      <option value="fontaneria">Fontanería</option>
                      <option value="electricidad">Electricidad</option>
                      <option value="albanileria">Albañilería / Pladur</option>
                      <option value="carpinteria">Carpintería</option>
                      <option value="pintura">Pintura</option>
                      <option value="limpieza">Limpieza</option>
                      <option value="jardineria">Jardinería</option>
                      <option value="inmobiliaria">Agente inmobiliario</option>
                      <option value="cerrajeria">Cerrajería</option>
                      <option value="otros">Otros</option>
                    </Select>
                  </div>
                </div>
              )}

              <label className="ra-field">
                <span className="ra-field-label">
                  {profile.role === 'pro' ? 'Sobre ti y tus servicios' : 'Sobre ti'}
                </span>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  className="ra-input"
                  placeholder={
                    profile.role === 'tenant'
                      ? 'Trabajo con contrato indefinido y busco piso a largo plazo…'
                      : profile.role === 'pro'
                        ? 'Especialistas en reformas con más de 10 años…'
                        : 'Cuéntanos algo sobre ti…'
                  }
                />
                <span className="text-xs text-gray-500">Máximo 500 caracteres.</span>
              </label>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" disabled={saving} className="px-8">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
