// src/services/policy.service.ts
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';

export class PolicyService {
  static async acceptPolicy(
    userId: string,
    policyType: string,
    policyVersion: string
  ) {
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
