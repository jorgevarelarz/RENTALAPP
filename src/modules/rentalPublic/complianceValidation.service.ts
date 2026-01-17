import { Types } from 'mongoose';
import { Contract } from '../../models/contract.model';
import { Property } from '../../models/property.model';
import { SystemEvent } from '../../models/systemEvent.model';
import { emitSystemEvent } from '../../events/system.events';
import { ComplianceStatus } from './models/complianceStatus.model';
import { RentalPriceHistory } from './models/rentalPriceHistory.model';
import { TensionedArea } from './models/tensionedArea.model';
import { ComplianceReasonCode, ComplianceSeverity, ComplianceStatusValue, RULE_VERSION, type RuleInputs } from './types';

export type EvaluateComplianceOptions = {
  changeDate?: Date;
  reason?: string;
  source?: string;
  previousRent?: number;
  newRent?: number;
  requestId?: string;
};

function buildAreaKey(region?: string, city?: string, zoneCode?: string) {
  const normalizedRegion = String(region || '').trim().toLowerCase();
  const normalizedCity = String(city || '').trim().toLowerCase();
  const normalizedZone = String(zoneCode || '').trim().toLowerCase();
  return `${normalizedRegion}|${normalizedCity}|${normalizedZone}`;
}

async function getPreviousRent(propertyId: Types.ObjectId, fallback?: number) {
  const last = await RentalPriceHistory.findOne({ property: propertyId })
    .sort({ changeDate: -1 })
    .select('previousRent newRent')
    .lean();
  if (last) return typeof last.newRent === 'number' ? last.newRent : last.previousRent;
  return fallback;
}

export async function evaluateAndPersist(contractId: string, opts: EvaluateComplianceOptions = {}) {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) throw new Error('contract_not_found');

  const property = await Property.findById(contract.property).lean();
  if (!property) throw new Error('property_not_found');

  const newRent =
    typeof opts.newRent === 'number'
      ? opts.newRent
      : typeof contract.rent === 'number'
        ? contract.rent
        : (contract as any).rentAmount;

  if (typeof newRent !== 'number') {
    throw new Error('rent_not_available');
  }

  const contractPreviousRent = (contract as any).previousRent;
  const previousRent =
    typeof opts.previousRent === 'number'
      ? opts.previousRent
      : typeof contractPreviousRent === 'number'
        ? contractPreviousRent
        : await getPreviousRent(property._id as any, undefined);

  const resolvedPreviousRent = typeof previousRent === 'number' ? previousRent : newRent;

  const rawChangeDate = opts.changeDate || contract.startDate || new Date();
  const changeDate = rawChangeDate instanceof Date ? rawChangeDate : new Date(rawChangeDate);
  const areaKeyFallback = buildAreaKey(property.region, property.city, (property as any).zoneCode);

  const geoPoint = (property as any).location;
  const geoQuery =
    geoPoint?.type === 'Point' && Array.isArray(geoPoint.coordinates) && geoPoint.coordinates.length === 2
      ? {
          geometry: { $geoIntersects: { $geometry: geoPoint } },
          active: true,
          effectiveFrom: { $lte: changeDate },
          $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: changeDate } }],
        }
      : null;

  const tensionedArea =
    (geoQuery
      ? await TensionedArea.findOne(geoQuery).sort({ effectiveFrom: -1 }).lean()
      : null) ||
    (await TensionedArea.findOne({
      areaKey: areaKeyFallback,
      active: true,
      effectiveFrom: { $lte: changeDate },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: changeDate } }],
    })
      .sort({ effectiveFrom: -1 })
      .lean());

  const isTensionedArea = !!tensionedArea;
  const resolvedAreaKey = tensionedArea?.areaKey || areaKeyFallback;

  let status = ComplianceStatusValue.Compliant;
  let severity = ComplianceSeverity.Info;
  const reasons: ComplianceReasonCode[] = [];
  if (isTensionedArea && newRent > resolvedPreviousRent) {
    status = ComplianceStatusValue.Risk;
    severity = ComplianceSeverity.Warning;
    reasons.push(ComplianceReasonCode.RentIncreaseTensionedArea);
  }

  const ruleInputs: RuleInputs = {
    previousRent: resolvedPreviousRent,
    newRent,
    changeDate,
  };

  const compliancePayload = {
    contract: contract._id,
    property: property._id,
    status,
    severity,
    checkedAt: new Date(),
    previousRent: resolvedPreviousRent,
    newRent,
    isTensionedArea,
    ruleVersion: RULE_VERSION,
    reasons,
    meta: {
      tensionedAreaId: tensionedArea?._id,
      areaKey: resolvedAreaKey,
      ruleInputs,
    },
  };

  await ComplianceStatus.findOneAndUpdate(
    { contract: contract._id },
    { $set: compliancePayload, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (status === ComplianceStatusValue.Risk) {
    const eventPayload = {
      type: 'COMPLIANCE_RISK_CREATED',
      resourceType: 'contract',
      resourceId: String(contract._id),
      payload: {
        complianceStatus: {
          status,
          severity,
          reasons,
          checkedAt: compliancePayload.checkedAt,
        },
        areaKey: resolvedAreaKey,
        requestId: opts.requestId,
      },
    };

    await SystemEvent.updateOne(
      { type: eventPayload.type, resourceType: eventPayload.resourceType, resourceId: eventPayload.resourceId },
      { $setOnInsert: { ...eventPayload, createdAt: new Date() }, $set: { updatedAt: new Date() } },
      { upsert: true },
    );

    emitSystemEvent({ ...eventPayload, createdAt: new Date().toISOString() });
  }

  const existingHistory = await RentalPriceHistory.findOne({ contract: contract._id })
    .select('_id')
    .lean();
  if (!existingHistory) {
    const historyPayload = {
      property: property._id,
      contract: contract._id,
      previousRent: resolvedPreviousRent,
      newRent,
      changeDate,
      reason: opts.reason || 'contract_created',
      source: opts.source || 'system',
    };

    await RentalPriceHistory.create(historyPayload);
  }

  return { status, reasons, isTensionedArea, areaKey: resolvedAreaKey };
}

export { buildAreaKey };
