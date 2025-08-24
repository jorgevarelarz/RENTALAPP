import { Router } from "express";
import PlatformEarning from "../models/platformEarning.model";
import { startOfDay, endOfDay, subDays } from "date-fns";

const r = Router();

r.get("/earnings/summary", async (req, res) => {
  const { from, to, groupBy = "day" } = req.query as Record<string, string>;
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : subDays(toDate, 30);

  const match = { createdAt: { $gte: startOfDay(fromDate), $lte: endOfDay(toDate) } };

  const fmt = groupBy === "month"
    ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
    : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

  const agg = await PlatformEarning.aggregate([
    { $match: match },
    {
      $group: {
        _id: fmt,
        gross: { $sum: "$gross" },
        fee: { $sum: "$fee" },
        net: { $sum: "$netToPro" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totals = agg.reduce(
    (a, x) => ({ gross: a.gross + x.gross, fee: a.fee + x.fee, net: a.net + x.net }),
    { gross: 0, fee: 0, net: 0 }
  );

  res.json({
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    groupBy,
    totals,
    items: agg.map((x) => ({ period: x._id, gross: x.gross, fee: x.fee, net: x.net })),
  });
});

r.get("/earnings/list", async (req, res) => {
  const { from, to, page = "1", limit = "20", ticketId, proId } = req.query as Record<string, string>;
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : subDays(toDate, 30);

  const q: any = { createdAt: { $gte: startOfDay(fromDate), $lte: endOfDay(toDate) } };
  if (ticketId) q.ticketId = ticketId;
  if (proId) q.proId = proId;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    PlatformEarning.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    PlatformEarning.countDocuments(q),
  ]);

  res.json({ items, total, page: p, limit: l });
});

r.get("/earnings/export.csv", async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : subDays(toDate, 30);

  const q = { createdAt: { $gte: startOfDay(fromDate), $lte: endOfDay(toDate) } };
  const rows = await PlatformEarning.find(q).sort({ createdAt: 1 }).lean();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="earnings_${from || ""}_${to || ""}.csv"`
  );

  const header = "createdAt,ticketId,escrowId,gross,fee,netToPro,currency,releaseRef\n";
  const body = rows
    .map((r) =>
      [
        r.createdAt?.toISOString(),
        r.ticketId,
        r.escrowId,
        r.gross?.toFixed(2),
        r.fee?.toFixed(2),
        r.netToPro?.toFixed(2),
        r.currency || "EUR",
        r.releaseRef || "",
      ].join(",")
    )
    .join("\n");

  res.send(header + body);
});

export default r;
