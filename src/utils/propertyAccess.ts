/**
 * La agencia gestiona el inmueble: es su `agencyId` y no lo ha traspasado al propietario
 * (`agencyAccess: 'manage'`). Tras el traspaso (`status_only`) solo ve el resumen.
 */
export function isManagingAgency(user: any, property: any): boolean {
  const userId = String(user?._id ?? user?.id ?? '');
  return (
    user?.role === 'agency' &&
    !!userId &&
    property?.agencyAccess === 'manage' &&
    property?.agencyId != null &&
    String(property.agencyId) === userId
  );
}
