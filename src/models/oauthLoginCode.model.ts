import { Schema, model } from 'mongoose';

const oauthLoginCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    redirect: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

oauthLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthLoginCode = model('OAuthLoginCode', oauthLoginCodeSchema);
