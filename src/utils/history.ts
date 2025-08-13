import { ContractHistory } from '../models/history.model';

/**
 * Append a history entry for a contract. Use this helper whenever the
 * contract's state changes (creation, signature, payment, etc.).
 */
export const recordContractHistory = async (
  contractId: string,
  action: string,
  description?: string,
) => {
  try {
    await new ContractHistory({ contract: contractId, action, description }).save();
  } catch (error) {
    console.error('Error al registrar historial del contrato:', error);
  }
};