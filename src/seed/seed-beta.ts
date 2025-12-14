/**
 * scripts/seed-beta.ts
 *
 * Seed mínimo para beta (Mongo directo)
 * Crea o reutiliza:
 *  - Landlord demo
 *  - Property demo
 *  - Contract demo vinculado al tenant existente (por email)
 *
 * Requisitos:
 *  - MONGO_URI (o MONGODB_URI) en variables de entorno
 *
 * Ejecución (Railway Cron / local):
 *  npm exec ts-node scripts/seed-beta.ts
 *
 * Limpieza:
 *  Usa meta.seedTag impreso al final para borrar fácilmente.
 */

import { MongoClient, ObjectId } from "mongodb";

/* =========================
   CONFIGURACIÓN BÁSICA
========================= */

const COLLECTIONS = {
  users: "users",
  properties: "properties",
  contracts: "contracts",
};

const USER_EMAIL_FIELD = "email";

const ROLE_TENANT = "tenant";
const ROLE_LANDLORD = "landlord";

/* =========================
   ENV
========================= */

type SeedEnv = {
  MONGO_URI: string;
  SEED_TENANT_EMAIL: string;
  SEED_TAG: string;
  DB_NAME?: string;
};

function loadEnv(): SeedEnv {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    throw new Error("❌ Missing env var: MONGO_URI (or MONGODB_URI)");
  }

  return {
    MONGO_URI,
    SEED_TENANT_EMAIL: process.env.SEED_TENANT_EMAIL || "prueba@smoke.test",
    SEED_TAG:
      process.env.SEED_TAG ||
      `seed-beta-${new Date().toISOString().slice(0, 10)}`,
    DB_NAME: process.env.DB_NAME,
  };
}

function toObjectId(value: any, label: string): ObjectId {
  if (!value) throw new Error(`❌ Missing ${label}`);
  if (value instanceof ObjectId) return value;
  try {
    return new ObjectId(String(value));
  } catch {
    throw new Error(`❌ Invalid ObjectId for ${label}: ${value}`);
  }
}

/* =========================
   MAIN
========================= */

async function main() {
  const env = loadEnv();

  const client = new MongoClient(env.MONGO_URI);
  await client.connect();

  const db = env.DB_NAME ? client.db(env.DB_NAME) : client.db();

  const usersCol = db.collection(COLLECTIONS.users);
  const propertiesCol = db.collection(COLLECTIONS.properties);
  const contractsCol = db.collection(COLLECTIONS.contracts);

  /* -------------------------
     1) TENANT EXISTENTE
  ------------------------- */

  const tenant = await usersCol.findOne({
    [USER_EMAIL_FIELD]: env.SEED_TENANT_EMAIL,
  });

  if (!tenant?._id) {
    throw new Error(
      `❌ Tenant no encontrado: ${USER_EMAIL_FIELD}=${env.SEED_TENANT_EMAIL}`
    );
  }

  const tenantId = toObjectId(tenant._id, "tenant._id");

  if ((tenant as any).role && (tenant as any).role !== ROLE_TENANT) {
    console.warn(
      `⚠️  El usuario ${env.SEED_TENANT_EMAIL} no tiene role=tenant (role=${(tenant as any).role}). Continúo igualmente.`
    );
  }

  /* -------------------------
     2) LANDLORD DEMO
  ------------------------- */

  const landlordEmail = "landlord.demo@rentalapp.test";

  const landlordResult = await usersCol.findOneAndUpdate(
    { [USER_EMAIL_FIELD]: landlordEmail },
    {
      $setOnInsert: {
        [USER_EMAIL_FIELD]: landlordEmail,
        role: ROLE_LANDLORD,
        name: "Landlord Demo",
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        meta: {
          seedTag: env.SEED_TAG,
          purpose: "beta-seed",
        },
      },
      $set: {
        updatedAt: new Date(),
        "meta.seedTag": env.SEED_TAG,
      },
    },
    { upsert: true, returnDocument: "after" }
  );


     if (!landlordResult || !landlordResult.value) {
            throw new Error("❌ No se pudo crear/encontrar el landlord demo");
          }
  const landlord = landlordResult.value!;
  if (!landlord?._id) {
    throw new Error("❌ No se pudo crear/encontrar el landlord demo");
  }

  const landlordId = toObjectId(landlord._id, "landlord._id");

  /* -------------------------
     3) PROPERTY DEMO
  ------------------------- */

  const propertyKey = "demo-property";

  const existingProperty = await propertiesCol.findOne({
    ownerId: landlordId,
    "meta.seedTag": env.SEED_TAG,
    "meta.key": propertyKey,
  });

  let propertyId: ObjectId;

  if (existingProperty?._id) {
    propertyId = toObjectId(existingProperty._id, "property._id");
  } else {
    const propertyDoc = {
      ownerId: landlordId,

      title: "Piso Demo Beta",
      description:
        "Propiedad de prueba creada por seed-beta.ts para validar el flujo de firma.",
      type: "apartment",

      city: "A Coruña",
      address: "Demo Street 123",
      postalCode: "15001",
      country: "ES",

      rooms: 2,
      bathrooms: 1,
      areaM2: 60,
      furnished: true,

      priceMonthly: 800,
      deposit: 800,
      currency: "EUR",

      status: "active",
      published: true,

      createdAt: new Date(),
      updatedAt: new Date(),

      meta: {
        seedTag: env.SEED_TAG,
        key: propertyKey,
        purpose: "beta-seed",
      },
    };

    const insert = await propertiesCol.insertOne(propertyDoc);
    propertyId = insert.insertedId;
  }

  /* -------------------------
     4) CONTRACT DEMO
  ------------------------- */

  const existingContract = await contractsCol.findOne({
    tenantId,
    propertyId,
    "meta.seedTag": env.SEED_TAG,
  });

  let contractId: ObjectId;

  if (existingContract?._id) {
    contractId = toObjectId(existingContract._id, "contract._id");
  } else {
    const contractDoc = {
      landlordId,
      tenantId,
      propertyId,

      status: "draft", // o "pending_signature" si tu sistema lo requiere

      startDate: new Date(),
      endDate: null,

      rentMonthly: 800,
      deposit: 800,
      currency: "EUR",

      signature: {
        provider: null,
        envelopeId: null,
        status: "not_started",
      },

      createdAt: new Date(),
      updatedAt: new Date(),

      meta: {
        seedTag: env.SEED_TAG,
        purpose: "beta-seed",
        notes: "Contrato demo creado para validar flujo de firma.",
      },
    };

    const insert = await contractsCol.insertOne(contractDoc);
    contractId = insert.insertedId;
  }

  /* -------------------------
     OUTPUT
  ------------------------- */

  console.log("✅ Seed beta completado con éxito");
  console.log("--------------------------------------------------");
  console.log("Tenant email :", env.SEED_TENANT_EMAIL);
  console.log("Tenant _id   :", String(tenantId));
  console.log("Landlord _id :", String(landlordId));
  console.log("Landlord email:", landlordEmail);
  console.log("Property _id :", String(propertyId));
  console.log("Contract _id :", String(contractId));
  console.log("seedTag      :", env.SEED_TAG);
  console.log("--------------------------------------------------");
  console.log("Para limpiar datos:");
  console.log(
    `db.${COLLECTIONS.contracts}.deleteMany({ "meta.seedTag": "${env.SEED_TAG}" })`
  );
  console.log(
    `db.${COLLECTIONS.properties}.deleteMany({ "meta.seedTag": "${env.SEED_TAG}" })`
  );
  console.log(
    `db.${COLLECTIONS.users}.deleteMany({ "${USER_EMAIL_FIELD}": "${landlordEmail}" })`
  );

  await client.close();
}

/* =========================
   RUN
========================= */

main().catch((err) => {
  console.error("❌ Error ejecutando seed-beta:", err);
  process.exit(1);
});
