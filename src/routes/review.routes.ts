import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import Review from '../models/review.model';
import Pro from '../models/pro.model';
import { User } from '../models/user.model';
import { Contract } from '../models/contract.model';
import ServiceOffer from '../models/serviceOffer.model';
import Ticket from '../models/ticket.model';
import { getUserId } from '../utils/getUserId';

const r = Router();

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

// Contratos que han llegado a firmarse; un borrador o uno cancelado no da derecho a reseña.
const REVIEWABLE_CONTRACT_STATUSES = ['signed', 'active', 'terminated', 'completed'];
const REVIEWABLE_OFFER_STATUSES = ['paid', 'confirmed', 'done'];

/**
 * Comprueba que `relatedId` es una relación real entre quien reseña y quien
 * recibe la reseña: un contrato firmado entre casero e inquilino o un servicio
 * pagado/cerrado del profesional. Sin esto cualquiera podía crear reseñas
 * ilimitadas sobre cualquier usuario cambiando `relatedId`.
 */
async function isReviewableRelation(
  fromUserId: string,
  toUserId: string,
  roleContext: 'tenant' | 'owner' | 'pro',
  relatedId: string,
) {
  if (!isValidObjectId(relatedId)) return false;

  if (roleContext === 'pro') {
    const offer = await ServiceOffer.findOne({
      _id: relatedId,
      proId: toUserId,
      ownerId: fromUserId,
      status: { $in: REVIEWABLE_OFFER_STATUSES },
    }).lean();
    if (offer) return true;
    const ticket = await Ticket.findOne({
      _id: relatedId,
      proId: toUserId,
      status: 'closed',
      $or: [{ openedBy: fromUserId }, { ownerId: fromUserId }],
    }).lean();
    return Boolean(ticket);
  }

  const contract = await Contract.findOne({
    _id: relatedId,
    status: { $in: REVIEWABLE_CONTRACT_STATUSES },
  })
    .select('landlord tenant')
    .lean();
  if (!contract) return false;
  const landlord = String(contract.landlord);
  const tenant = String(contract.tenant);
  return roleContext === 'tenant'
    ? toUserId === tenant && fromUserId === landlord
    : toUserId === landlord && fromUserId === tenant;
}

r.post('/', async (req, res) => {
  try {
    const fromUserId = getUserId(req);
    const body = req.body || {};
    const { roleContext, score, comment } = body;
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId : '';
    const relatedId = typeof body.relatedId === 'string' ? body.relatedId : '';

    if (!toUserId || !roleContext || !relatedId || score === undefined) {
      return res.status(400).json({ error: 'missing fields', code: 400 });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'cannot review yourself', code: 400 });
    }
    if (!['tenant', 'owner', 'pro'].includes(roleContext)) {
      return res.status(400).json({ error: 'invalid roleContext', code: 400 });
    }
    const numericScore = Number(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 5) {
      return res.status(400).json({ error: 'score must be between 0 and 5', code: 400 });
    }
    if (comment && String(comment).length > 1000) {
      return res.status(400).json({ error: 'comment too long', code: 400 });
    }

    if (!(await isReviewableRelation(fromUserId, toUserId, roleContext, relatedId))) {
      return res.status(403).json({ error: 'no relation to review', code: 403 });
    }

    const existing = await Review.findOne({ fromUserId, toUserId, relatedId });
    if (existing) {
      return res.status(409).json({ error: 'already reviewed', code: 409 });
    }

    const rev = await Review.create({
      fromUserId,
      toUserId,
      roleContext,
      relatedId,
      score: numericScore,
      comment
    });

    if (roleContext === 'pro') {
      const pro = await Pro.findOne({ userId: toUserId });
      if (pro) {
        const newCount = pro.reviewCount + 1;
        const newAvg = ((pro.ratingAvg * pro.reviewCount) + numericScore) / newCount;
        pro.reviewCount = newCount;
        pro.ratingAvg = Number(newAvg.toFixed(2));
        await pro.save();
      }
    } else {
      const user = await User.findById(toUserId);
      if (user) {
        const currentAvg = (user as any).ratingAvg || 0;
        const currentCount = (user as any).reviewCount || 0;
        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + numericScore) / newCount;
        (user as any).reviewCount = newCount;
        (user as any).ratingAvg = Number(newAvg.toFixed(2));
        await user.save();
      }
    }

    res.status(201).json(rev);
  } catch (err: any) {
    // Dos envíos simultáneos: el índice único deja pasar solo uno.
    if (err?.code === 11000) return res.status(409).json({ error: 'already reviewed', code: 409 });
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/user/:userId', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const q: any = { toUserId: req.params.userId };
    if (typeof req.query.roleContext === 'string') q.roleContext = req.query.roleContext;
    const [items, total] = await Promise.all([
      Review.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Review.countDocuments(q)
    ]);
    res.json({ items, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/user/:userId/avg', async (req, res) => {
  try {
    const agg = await Review.aggregate([
      { $match: { toUserId: req.params.userId } },
      { $group: { _id: null, avgScore: { $avg: '$score' }, count: { $sum: 1 } } }
    ]);
    const avgScore = agg[0]?.avgScore || 0;
    const count = agg[0]?.count || 0;
    res.json({ avgScore, count });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

export default r;
