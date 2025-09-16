import mongoose from "mongoose";
import { Contract } from "../src/models/contract.model";

async function run() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL no definido");
  }
  await mongoose.connect(process.env.MONGO_URL);

  await Contract.updateMany(
    { clausePolicyVersion: { $exists: false } },
    { $set: { clausePolicyVersion: "1.0.0" } }
  );

  await Contract.updateMany(
    { status: { $exists: false } },
    { $set: { status: "pending_signature" } }
  );

  console.log("Migration done");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
