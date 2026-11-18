export type LandlordPropertyLike = {
  _id?: string;
  title?: string;
  city?: string;
  price?: number;
  sizeM2?: number;
  status?: string;
  images?: unknown[];
  photos?: unknown[];
};

export type LandlordAlert = {
  id: string;
  tone: 'warning' | 'info';
  title: string;
  detail: string;
};

const CITY_EUR_M2: Record<string, number> = {
  madrid: 22,
  barcelona: 24,
  valencia: 15,
  sevilla: 13,
  malaga: 16,
  bilbao: 17,
  zaragoza: 12,
};

export function propertyPhotoCount(property: LandlordPropertyLike) {
  return Math.max(property.images?.length || 0, property.photos?.length || 0);
}

export function estimateMonthlyRent(property: LandlordPropertyLike) {
  const size = Number(property.sizeM2 || 0);
  if (!size) return null;
  const cityKey = String(property.city || '').trim().toLowerCase();
  const eurM2 = CITY_EUR_M2[cityKey] || 14;
  return Math.round(size * eurM2);
}

const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export function buildLandlordAlerts(properties: LandlordPropertyLike[]) {
  const alerts: LandlordAlert[] = [];
  const missingPhotos = properties.filter((property) => propertyPhotoCount(property) < 3);
  const publishedVacant = properties.filter((property) => property.status === 'active');
  const drafts = properties.filter((property) => property.status !== 'active' && property.status !== 'rented');
  const priceOutliers = properties.filter((property) => {
    const estimate = estimateMonthlyRent(property);
    const price = Number(property.price || 0);
    if (!estimate || !price) return false;
    return Math.abs(price - estimate) / estimate > 0.2;
  });

  if (missingPhotos.length) {
    alerts.push({
      id: 'missing-photos',
      tone: 'warning',
      title: countLabel(missingPhotos.length, 'propiedad con pocas fotos', 'propiedades con pocas fotos'),
      detail: 'Publicar requiere al menos 3 fotos. Completa las fichas para mejorar conversión.',
    });
  }

  if (drafts.length) {
    alerts.push({
      id: 'drafts',
      tone: 'info',
      title: countLabel(drafts.length, 'borrador pendiente', 'borradores pendientes'),
      detail: 'Revisa precio, descripción y documentos para publicarlos.',
    });
  }

  if (publishedVacant.length) {
    alerts.push({
      id: 'vacant-active',
      tone: 'info',
      title: countLabel(publishedVacant.length, 'anuncio publicado', 'anuncios publicados'),
      detail: 'Comprueba solicitudes y ajusta precio si no reciben contactos.',
    });
  }

  if (priceOutliers.length) {
    alerts.push({
      id: 'price-outliers',
      tone: 'warning',
      title: countLabel(priceOutliers.length, 'precio a revisar', 'precios a revisar'),
      detail: 'La estimación por m² detecta una desviación superior al 20 %.',
    });
  }

  return alerts.slice(0, 4);
}
