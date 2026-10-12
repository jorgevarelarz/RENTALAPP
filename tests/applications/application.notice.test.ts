import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { sessionToken } from "../utils/sessionToken";
import { User } from "../../src/models/user.model";
import { Property } from "../../src/models/property.model";
import { Application } from "../../src/models/application.model";
import { applicationNoticeEmail, sendApplicationNoticeEmail, visitDateLabel } from "../../src/utils/email";

jest.mock("../../src/utils/email", () => ({
  ...jest.requireActual("../../src/utils/email"),
  sendApplicationNoticeEmail: jest.fn().mockResolvedValue("sent"),
}));
const sent = sendApplicationNoticeEmail as jest.MockedFunction<typeof sendApplicationNoticeEmail>;

/** El aviso sale después de responder: espera a que lleguen `n` correos. */
const waitForEmails = async (n: number) => {
  for (let i = 0; i < 50 && sent.mock.calls.length < n; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return sent.mock.calls;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 150));

const OWNER = "507f1f77bcf86cd799439a71";
const TENANT = "507f1f77bcf86cd799439a72";
const AGENCY = "507f1f77bcf86cd799439a73";
const auth = async (id: string, role: string) => `Bearer ${await sessionToken({ _id: id, role, isVerified: true })}`;
const VISIT = "2027-10-14T16:00:00.000Z"; // jueves, 14 de octubre de 2027, 18:00 en Madrid

describe("Avisos por correo de solicitudes y visitas", () => {
  let propertyId: string;

  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(async () => {
    sent.mockClear();
    await User.create([
      { _id: OWNER, name: "Marta Casero", email: "marta@test.com", role: "landlord", isVerified: true },
      { _id: TENANT, name: "Ana Inquilina", email: "ana@test.com", role: "tenant", isVerified: true, tenantPro: { status: "verified", maxRent: 2000 } },
      { _id: AGENCY, name: "Fincas Sol", email: "fincas@test.com", role: "agency", isVerified: true },
    ]);
    const p = await Property.create({
      owner: OWNER,
      title: "Piso en Chamberí",
      address: "C/ Luchana 10",
      region: "madrid",
      city: "Madrid",
      location: { type: "Point", coordinates: [-3.7, 40.43] },
      price: 1100,
      deposit: 1100,
      availableFrom: new Date("2026-11-01"),
      status: "active",
    });
    propertyId = String(p._id);
  });
  afterEach(clearDb);

  it("una solicitud nueva avisa al propietario con el mensaje y el enlace a sus candidatos; repetirla no avisa otra vez", async () => {
    const tenant = await auth(TENANT, "tenant");
    await request(app).post(`/api/properties/${propertyId}/apply`).set("Authorization", tenant)
      .send({ message: "Hola, me mudo en noviembre." }).expect(200);
    const calls = await waitForEmails(1);
    expect(calls).toHaveLength(1);
    const [to, notice] = calls[0];
    expect(to).toBe("marta@test.com");
    expect(notice).toMatchObject({
      kind: "received",
      audience: "manager",
      name: "Marta Casero",
      otherName: "Ana Inquilina",
      message: "Hola, me mudo en noviembre.",
      tenantVerified: true,
      propertyTitle: "Piso en Chamberí",
    });
    expect(notice.link).toMatch(new RegExp(`/landlord\\?solicitudes=${propertyId}$`));

    await request(app).post(`/api/properties/${propertyId}/apply`).set("Authorization", tenant).send({}).expect(200);
    await settle();
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("con agencia gestora avisa también a la agencia, con su propio enlace", async () => {
    await Property.updateOne({ _id: propertyId }, { agencyId: AGENCY, agencyAccess: "manage" });
    await request(app).post(`/api/properties/${propertyId}/apply`).set("Authorization", await auth(TENANT, "tenant")).send({}).expect(200);
    const calls = await waitForEmails(2);
    const byTo = Object.fromEntries(calls.map(([to, n]) => [to, n]));
    expect(Object.keys(byTo).sort()).toEqual(["fincas@test.com", "marta@test.com"]);
    expect(byTo["fincas@test.com"].link).toMatch(new RegExp(`/agency/properties\\?solicitudes=${propertyId}$`));
  });

  it("la agencia sin gestión (status_only) no recibe el aviso", async () => {
    await Property.updateOne({ _id: propertyId }, { agencyId: AGENCY, agencyAccess: "status_only" });
    await request(app).post(`/api/properties/${propertyId}/apply`).set("Authorization", await auth(TENANT, "tenant")).send({}).expect(200);
    await waitForEmails(1);
    await settle();
    expect(sent.mock.calls.map(c => c[0])).toEqual(["marta@test.com"]);
  });

  it("el casero propone fecha → avisa al inquilino; el inquilino acepta → avisa al casero", async () => {
    const created = await Application.create({ propertyId, tenantId: TENANT });
    await request(app).post(`/api/applications/${created._id}/propose`).set("Authorization", await auth(OWNER, "landlord"))
      .send({ visitDate: VISIT }).expect(200);
    let calls = await waitForEmails(1);
    expect(calls[0][0]).toBe("ana@test.com");
    expect(calls[0][1]).toMatchObject({ kind: "proposed", audience: "tenant", otherName: "Marta Casero" });
    expect(calls[0][1].date?.toISOString()).toBe(VISIT);
    expect(calls[0][1].link).toMatch(/\/tenant\/applications$/);

    await request(app).post(`/api/applications/${created._id}/accept`).set("Authorization", await auth(TENANT, "tenant")).expect(200);
    calls = await waitForEmails(2);
    expect(calls[1][0]).toBe("marta@test.com");
    expect(calls[1][1]).toMatchObject({ kind: "scheduled", audience: "manager", otherName: "Ana Inquilina" });
    expect(calls[1][1].date?.toISOString()).toBe(VISIT);
    expect(calls[1][1].message).toBeUndefined();
  });

  it("el inquilino propone fecha → avisa al casero; la agencia gestora acepta → avisa al inquilino con su nombre", async () => {
    await Property.updateOne({ _id: propertyId }, { agencyId: AGENCY, agencyAccess: "manage" });
    const created = await Application.create({ propertyId, tenantId: TENANT });
    await request(app).post(`/api/applications/${created._id}/propose`).set("Authorization", await auth(TENANT, "tenant"))
      .send({ visitDate: VISIT }).expect(200);
    let calls = await waitForEmails(2);
    expect(calls.map(c => c[0]).sort()).toEqual(["fincas@test.com", "marta@test.com"]);
    expect(calls[0][1]).toMatchObject({ kind: "proposed", audience: "manager" });

    await request(app).post(`/api/applications/${created._id}/accept`).set("Authorization", await auth(AGENCY, "agency")).expect(200);
    calls = await waitForEmails(3);
    expect(calls[2][0]).toBe("ana@test.com");
    expect(calls[2][1]).toMatchObject({ kind: "scheduled", audience: "tenant", otherName: "Fincas Sol" });
  });

  it("una propuesta rechazada (fecha pasada) no avisa a nadie", async () => {
    const created = await Application.create({ propertyId, tenantId: TENANT });
    await request(app).post(`/api/applications/${created._id}/propose`).set("Authorization", await auth(OWNER, "landlord"))
      .send({ visitDate: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }).expect(400);
    await settle();
    expect(sent).not.toHaveBeenCalled();
  });
});

describe("applicationNoticeEmail", () => {
  it("escapa el mensaje y el nombre, y pone la fecha en Madrid", () => {
    const date = new Date(VISIT);
    expect(visitDateLabel(date)).toBe("jueves, 14 de octubre a las 18:00");
    const received = applicationNoticeEmail({
      kind: "received",
      audience: "manager",
      link: "https://app.rentalapp.es/landlord?solicitudes=abc",
      otherName: "<b>Ana</b>",
      propertyTitle: "Piso en Chamberí",
      message: "Hola <script>alert(1)</script>\nSegunda línea",
      tenantVerified: true,
    });
    expect(received.subject).toBe("Nueva solicitud de visita: Piso en Chamberí");
    expect(received.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(received.html).toContain("&lt;script&gt;");
    expect(received.html).not.toContain("<script>");
    expect(received.html).toContain("solvencia verificada");

    const proposed = applicationNoticeEmail({ kind: "proposed", audience: "tenant", link: "https://x/tenant/applications", date });
    expect(proposed.subject).toBe("Fecha de visita propuesta: jueves, 14 de octubre a las 18:00");
    expect(proposed.html).toContain("El propietario te propone visitar la vivienda");
    expect(proposed.html).toContain("Aceptar o proponer otra fecha");
    expect(proposed.html).not.toContain("solvencia");
  });
});
