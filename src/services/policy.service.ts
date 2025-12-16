// src/services/policy.service.ts
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';
import { PolicyVersion, IPolicyVersion } from '../models/policy.model';

export interface PolicyMeta {
  ip?: string;
  userAgent?: string;
}

export class PolicyService {
  static async createVersion(
    policyType: IPolicyVersion['policyType'],
    version: string,
    expiresAt?: Date | null
  ) {
    // Mark previous versions as inactive
    await PolicyVersion.updateMany(
      { policyType },
      { $set: { isActive: false } }
    );

    const policy = new PolicyVersion({
      policyType,
      version,
      expiresAt: expiresAt || null,
      isActive: true,
    });
    await policy.save();
    return policy;
  }

  static async getActiveVersion(
    policyType: IPolicyVersion['policyType']
  ): Promise<IPolicyVersion | null> {
    const now = new Date();
    return PolicyVersion.findOne({
      policyType,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ createdAt: -1 });
  }

  static async getActiveVersions() {
    const now = new Date();
    return PolicyVersion.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .sort({ policyType: 1, createdAt: -1 })
      .lean();
  }

  static async acceptPolicy(
    userId: string,
    policyType: string,
    policyVersion: string,
    meta: PolicyMeta = {}
  ) {
    // Validate active version
    const active = await this.getActiveVersion(policyType as any);
    if (!active || active.version !== policyVersion) {
      throw Object.assign(new Error('Policy version is not active'), {
        code: 'POLICY_INACTIVE',
      });
    }

    // Verificar si ya existe un registro
    const existing = await UserPolicyAcceptance.findOne({
      userId,
      policyType,
      policyVersion,
    });

    if (existing) {
      throw new Error('Policy already accepted for this version');
    }

    const acceptance = new UserPolicyAcceptance({
      userId,
      policyType,
      policyVersion,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await acceptance.save();
    return acceptance;
  }

  static async getUserAcceptances(userId: string) {
    return UserPolicyAcceptance.find({ userId })
      .sort({ acceptedAt: -1 })
      .lean();
  }
}
