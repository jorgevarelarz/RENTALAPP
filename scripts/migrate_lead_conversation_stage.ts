import 'dotenv/config';
import mongoose from 'mongoose';
import Lead from '../src/models/lead.model';
import { inferConversationStageForLeadDoc } from '../src/services/inboundLead.service';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const leads = await Lead.find();
  let updated = 0;

  for (const lead of leads) {
    const nextStage = inferConversationStageForLeadDoc(lead);
    if (lead.conversationStage !== nextStage) {
      lead.conversationStage = nextStage;
      await lead.save();
      updated += 1;
    }
  }

  console.log(`Lead migration completed. Updated ${updated} lead(s).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
