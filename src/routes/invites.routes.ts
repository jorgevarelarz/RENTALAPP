import { Router } from 'express';
import { ContractParty } from '../models/contractParty.model';
import { getUserId } from '../utils/getUserId';
import { User } from '../models/user.model';
import { Types } from 'mongoose';
import crypto from 'crypto';

const r = Router();

r.post('/accept', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const party = await ContractParty.findOne({ inviteTokenHash: tokenHash, status: 'INVITED' });
    if (!party) {
      return res.status(404).json({ error: 'invite_not_found' });
    }
    if (party.inviteExpiresAt && party.inviteExpiresAt < new Date()) {
      return res.status(400).json({ error: 'invite_expired' });
    }
    let userEmail = (req as any).user?.email?.toLowerCase?.();
    if (!userEmail) {
      const u = await User.findById(userId).select('email').lean();
      userEmail = u?.email?.toLowerCase?.();
    }
    if (!userEmail || userEmail !== party.email) {
      return res.status(403).json({ error: 'email_mismatch' });
    }
    party.userId = new Types.ObjectId(userId);
    party.status = 'JOINED';
    party.inviteTokenHash = undefined;
    party.inviteExpiresAt = undefined;
    await party.save();
    res.json({ ok: true, partyId: party._id });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'invite_accept_failed' });
  }
});

export default r;
