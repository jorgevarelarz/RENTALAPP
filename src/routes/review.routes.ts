import { Router } from 'express';
import Review from '../models/review.model';
import Pro from '../models/pro.model';
import { User } from '../models/user.model';
import { getUserId } from '../utils/getUserId';

const r = Router();

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

r.post('/', async (req, res) => {
  try {
    const fromUserId = getUserId(req);
    const { toUserId, roleContext, relatedId, score, comment } = req.body || {};

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
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/user/:userId', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const q: any = { toUserId: req.params.userId };
    if (req.query.roleContext) q.roleContext = req.query.roleContext;
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
