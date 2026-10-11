import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { seedContractParties, LANDLORD_ID, TENANT_ID, PROPERTY_ID } from "../utils/contractParties";
import { Contract } from "../../src/models/contract.model";
import { Property } from "../../src/models/property.model";
import { User } from "../../src/models/user.model";

const OTHER_LANDLORD = "507f1f77bcf86cd799439021";
const AGENCY = "507f1f77bcf86cd799439031";

const payload = (overrides: Record<string, unknown> = {}) => ({
  landlord: LANDLORD_ID,
  tenant: TENANT_ID,
  property: PROPERTY_ID,
  region: "galicia",
  rent: 750,
  deposit: 750,
  startDate: "2026-11-01",
  endDate: "2027-10-31",
  clauses: [{ id: "duracion_prorroga", params: { mesesIniciales: 12, mesesProrroga: 12 } }],
  ...overrides,
});

const createAs = (userId: string, role: string, body: Record<string, unknown>) =>
  request(app).post("/api/contracts").set("x-user-id", userId).set("x-user-role", role).send(body);

describe("POST /api/contracts: quién puede crear el contrato (A2)", () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(() => seedContractParties({ agencyId: AGENCY }));
  afterEach(clearDb);

  it("el propietario del inmueble crea el contrato", async () => {
    const res = await createAs(LANDLORD_ID, "landlord", payload()).expect(201);
    expect(String(res.body.contract.landlord)).toBe(LANDLORD_ID);
  });

  it("acepta el cuerpo que arma el asistente /contracts/new, con todas sus cláusulas", async () => {
    // Mismo cuerpo que buildContractPayload (frontend/src/pages/contracts/contractDraft.ts)
    const clauses = [
      { id: "duracion_prorroga", params: { mesesIniciales: 24, mesesProrroga: 12 } },
      { id: "uso_vivienda", params: { permiteActividadProfesional: false } },
      { id: "mascotas", params: { permitidas: true, limite: 2 } },
      { id: "subarriendo", params: { permitido: false } },
      { id: "retraso_pago", params: { diasGracia: 5, recargoPct: 0 } },
      { id: "fianza_autonomica", params: {} },
    ];
    const res = await createAs(
      LANDLORD_ID,
      "landlord",
      payload({ rent: 900.5, deposit: 900.5, endDate: "2028-11-01", clauses }),
    ).expect(201);
    expect(res.body.contract.clauses.map((c: any) => c.id)).toEqual(clauses.map((c) => c.id));
    expect(res.body.contract.status).toBe("pending_signature");
  });

  it("acepta identificadores en mayúsculas", async () => {
    await createAs(LANDLORD_ID, "landlord", payload({ landlord: LANDLORD_ID.toUpperCase() })).expect(201);
  });

  it("otro casero no puede crear un contrato sobre un inmueble ajeno, ni a nombre del dueño ni al suyo", async () => {
    await User.create({ _id: OTHER_LANDLORD, name: "Otro", email: "otro@test.com", role: "landlord" });
    const asOwner = await createAs(OTHER_LANDLORD, "landlord", payload()).expect(403);
    expect(asOwner.body.error).toBe("forbidden");
    await createAs(OTHER_LANDLORD, "landlord", payload({ landlord: OTHER_LANDLORD })).expect(403);
    expect(await Contract.countDocuments()).toBe(0);
  });

  it("el arrendador del contrato tiene que ser el dueño del inmueble", async () => {
    const res = await createAs("000000000000000000000999", "admin", payload({ landlord: OTHER_LANDLORD })).expect(400);
    expect(res.body.error).toBe("landlord_not_owner");
  });

  it("el inquilino tiene que existir y no ser el propio arrendador", async () => {
    const missing = await createAs(LANDLORD_ID, "landlord", payload({ tenant: "507f1f77bcf86cd799439099" })).expect(400);
    expect(missing.body.error).toBe("tenant_not_found");
    const self = await createAs(LANDLORD_ID, "landlord", payload({ tenant: LANDLORD_ID })).expect(400);
    expect(self.body.error).toBe("tenant_is_landlord");
    expect(await Contract.countDocuments()).toBe(0);
  });

  it("inmueble inexistente: 404", async () => {
    const res = await createAs(LANDLORD_ID, "landlord", payload({ property: "507f1f77bcf86cd799439098" })).expect(404);
    expect(res.body.error).toBe("property_not_found");
  });

  it("la agencia que gestiona el inmueble puede crearlo; queda como agencia del contrato", async () => {
    const res = await createAs(AGENCY, "agency", payload()).expect(201);
    expect(String(res.body.contract.agencyId)).toBe(AGENCY);
  });

  it("una agencia ajena o con el inmueble ya traspasado (status_only) no puede", async () => {
    await createAs("507f1f77bcf86cd799439032", "agency", payload()).expect(403);
    await Property.updateOne({ _id: PROPERTY_ID }, { agencyAccess: "status_only" });
    await createAs(AGENCY, "agency", payload()).expect(403);
    expect(await Contract.countDocuments()).toBe(0);
  });

  it("un administrador puede crearlo; un inquilino no", async () => {
    await createAs("000000000000000000000999", "admin", payload()).expect(201);
    await createAs(TENANT_ID, "tenant", payload()).expect(403);
  });
});

describe("POST /api/contracts: la región sale del inmueble", () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(() => seedContractParties());
  afterEach(clearDb);

  it("sin región en el cuerpo usa la del inmueble", async () => {
    const { region, ...body } = payload();
    const res = await createAs(LANDLORD_ID, "landlord", body).expect(201);
    expect(res.body.contract.region).toBe("galicia");
  });

  it("traduce la región en texto libre del inmueble a la clave del catálogo", async () => {
    await Property.updateOne({ _id: PROPERTY_ID }, { region: "A Coruña, Galicia" });
    const res = await createAs(LANDLORD_ID, "landlord", payload()).expect(201);
    expect(res.body.contract.region).toBe("galicia");
  });

  it("rechaza una región distinta de la del inmueble (no se elige otra fianza autonómica)", async () => {
    const res = await createAs(LANDLORD_ID, "landlord", payload({ region: "madrid" })).expect(400);
    expect(res.body).toMatchObject({ error: "region_mismatch", propertyRegion: "galicia" });
    expect(await Contract.countDocuments()).toBe(0);
  });

  it("inmueble de una comunidad sin catálogo: region_not_supported aunque el cuerpo diga otra", async () => {
    await Property.updateOne({ _id: PROPERTY_ID }, { region: "Andalucía" });
    const res = await createAs(LANDLORD_ID, "landlord", payload()).expect(400);
    expect(res.body.error).toBe("region_not_supported");
    expect(await Contract.countDocuments()).toBe(0);
  });

  it("región inexistente en el cuerpo: region_not_supported", async () => {
    const res = await createAs(LANDLORD_ID, "landlord", payload({ region: "andromeda" })).expect(400);
    expect(res.body.error).toBe("region_not_supported");
  });
});
