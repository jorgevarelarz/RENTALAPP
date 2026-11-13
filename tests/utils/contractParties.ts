import { User } from "../../src/models/user.model";
import { Property } from "../../src/models/property.model";

export const LANDLORD_ID = "507f1f77bcf86cd799439011";
export const TENANT_ID = "507f1f77bcf86cd799439012";
export const PROPERTY_ID = "507f1f77bcf86cd799439013";

/**
 * Crear un contrato exige un inmueble del arrendador y un inquilino que exista (A2).
 * Siembra los tres con los identificadores que usan los tests de contratos.
 */
export const seedContractParties = async (
  ids: { landlord?: string; tenant?: string; property?: string; agencyId?: string } = {},
) => {
  const landlord = ids.landlord || LANDLORD_ID;
  const tenant = ids.tenant || TENANT_ID;
  const property = ids.property || PROPERTY_ID;
  await User.create({ _id: landlord, name: "Casero", email: `casero-${landlord}@test.com`, role: "landlord" });
  await User.create({ _id: tenant, name: "Inquilina", email: `inquilina-${tenant}@test.com`, role: "tenant" });
  await Property.create({
    _id: property,
    owner: landlord,
    ...(ids.agencyId ? { agencyId: ids.agencyId } : {}),
    title: "Piso en Santiago",
    address: "Rúa do Vilar 1",
    region: "galicia",
    city: "Santiago de Compostela",
    location: { type: "Point", coordinates: [-8.54, 42.88] },
    price: 750,
    deposit: 750,
    availableFrom: new Date(),
  });
  return { landlord, tenant, property };
};
