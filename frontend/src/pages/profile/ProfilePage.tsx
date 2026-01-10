import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import { userService, UserProfile } from '../../services/user';
import { toAbsoluteUrl } from '../../utils/media';

const RatingStars = ({ rating }: { rating: number }) => (
  <div className="flex items-center text-yellow-400">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < Math.round(rating) ? 'fill-current' : 'text-gray-300'}`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
    <span className="ml-2 text-gray-600 text-sm font-medium">{rating.toFixed(1)}</span>
  </div>
);

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
        push({ title: 'Error cargando perfil', tone: 'error' });
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
      push({ title: 'Formato de telefono invalido (ej: 600123456)', tone: 'error' });
      return;
    }
    if (formData.bio && formData.bio.length > 500) {
      push({ title: 'El texto "Sobre mi" no puede superar 500 caracteres', tone: 'error' });
      return;
    }
    if (profile?.role === 'tenant' && formData.monthlyIncome) {
      const income = Number(formData.monthlyIncome);
      if (!Number.isFinite(income) || income < 0) {
        push({ title: 'Los ingresos deben ser un numero positivo', tone: 'error' });
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
        push({ title: 'Avatar actualizado', tone: 'success' });
      } else {
        push({ title: 'No se pudo subir la imagen', tone: 'error' });
      }
    } catch (error) {
      push({ title: 'Error subiendo avatar', tone: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!profile) return <div>No se encontró el usuario.</div>;
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : '';
  const rating = typeof profile.ratingAvg === 'number' ? profile.ratingAvg : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
        <div className="px-8 pb-6 flex flex-col md:flex-row items-end md:items-center -mt-12 gap-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-md">
              {profile.avatar ? (
                <img src={toAbsoluteUrl(profile.avatar)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-3xl font-bold text-gray-400">
                  {profile.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={handleAvatarClick}
              className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-medium"
              disabled={uploading}
            >
              {uploading ? '...' : 'Cambiar foto'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 pt-12 md:pt-0">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.role === 'pro' && formData.companyName ? formData.companyName : formData.name}
                </h1>
                <p className="text-gray-500 flex items-center gap-2">
                  {profile.role === 'pro' && formData.companyName && (
                    <span className="text-sm">({formData.name})</span>
                  )}
                  <Badge tone="highlight" className="uppercase text-xs">
                    {profile.role === 'pro' && formData.serviceCategory !== 'general'
                      ? formData.serviceCategory
                      : profile.role === 'tenant'
                        ? 'Inquilino'
                        : profile.role === 'landlord'
                          ? 'Propietario'
                          : 'Profesional'}
                  </Badge>
                  {user?.isVerified && (
                    <Badge tone="highlight" className="uppercase text-xs">
                      KYC verificado
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">{profile.email}</p>
                {isTenantPro && (
                  <div className="mt-3">
                    <ProBadge maxRent={user?.tenantPro?.maxRent} />
                  </div>
                )}
              </div>

              <div className="text-right hidden md:block">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Puntuacion</p>
                <RatingStars rating={rating || 0} />
                {memberSince && (
                  <p className="text-xs text-gray-400 mt-1">Miembro desde {memberSince}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Tu reputacion</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Puntuacion media</span>
              <span className="font-bold text-indigo-600">{rating ? rating.toFixed(1) : 'Aun sin valoraciones'}</span>
            </div>
            {memberSince && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Antiguedad</span>
                <span className="font-bold text-gray-800">{memberSince}</span>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {profile.role === 'tenant' && 'Un perfil completo mejora tu visibilidad en solicitudes.'}
                {profile.role === 'landlord' && 'Los inquilinos prefieren propietarios con identidad verificada.'}
                {profile.role === 'pro' && 'Detalla tus servicios para aparecer en mas busquedas.'}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2 text-gray-700">Seguridad</h3>
            <Link to="/forgot-password">
              <Button variant="outline" className="w-full text-sm">
                Cambiar contrasena
              </Button>
            </Link>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Editar informacion</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Nombre personal (verificado)"
                  name="name"
                  value={formData.name}
                  disabled
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <Input
                  label="Telefono"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <Input
                label="Email"
                type="email"
                value={profile.email}
                disabled
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <span className="text-xs text-gray-400">El email no se puede cambiar.</span>

              {profile.role === 'tenant' && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                  <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">Datos de solvencia</h3>
                  <p className="text-xs text-blue-700">
                    Solo visible para propietarios tras enviar una solicitud.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Profesion / Cargo"
                      name="jobTitle"
                      value={formData.jobTitle}
                      onChange={handleChange}
                      placeholder="Ej: Desarrollador"
                    />
                    <Input
                      label="Ingresos mensuales (EUR)"
                      name="monthlyIncome"
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={handleChange}
                      placeholder="Ej: 2000"
                    />
                  </div>
                </div>
              )}

              {profile.role === 'pro' && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-4">
                  <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wide">Perfil profesional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Nombre de empresa"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      placeholder="Ej: Reformas Garcia"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad principal</label>
                      <select
                        name="serviceCategory"
                        value={formData.serviceCategory}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="general">Mantenimiento general</option>
                        <option value="fontaneria">Fontaneria</option>
                        <option value="electricidad">Electricidad</option>
                        <option value="albanileria">Albanileria / Pladur</option>
                        <option value="carpinteria">Carpinteria</option>
                        <option value="pintura">Pintura</option>
                        <option value="limpieza">Limpieza</option>
                        <option value="jardineria">Jardineria</option>
                        <option value="inmobiliaria">Agente inmobiliario</option>
                        <option value="cerrajeria">Cerrajeria</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sobre mi {profile.role === 'pro' ? '/ Descripcion de servicios' : ''}
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={
                    profile.role === 'tenant'
                      ? 'Hola, soy responsable y tengo contrato indefinido...'
                      : profile.role === 'pro'
                        ? 'Especialistas en reformas con mas de 10 anos...'
                        : 'Cuentanos algo sobre ti...'
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Maximo 500 caracteres.</p>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" disabled={saving} className="px-8">
                  {saving ? 'Guardando...' : 'Guardar perfil'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
