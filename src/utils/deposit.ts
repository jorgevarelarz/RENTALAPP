/**
 * Utility functions to manage rental deposits (fianzas). Depending on your
 * business logic deposits can either be paid into an escrow account
 * controlled by the platform or transferred directly to a public agency.
 *
 * The implementations below are placeholders; replace the body of these
 * functions with actual integrations with your banking provider or
 * governmental API when deploying the application in production.
 */

/**
 * Simulates sending a deposit to a platform escrow account. In a real
 * implementation this would initiate a transfer via your payment provider.
 * Returns a promise that resolves when the transfer is considered
 * successful.
 *
 * @param contractId The ID of the contract for which the deposit is paid.
 * @param amount The amount of the deposit in EUR.
 */
export const depositToEscrow = async (contractId: string, amount: number): Promise<void> => {
  // TODO: integrate with your payment API here
  console.log(`Simulating deposit of €${amount} for contract ${contractId} to escrow account.`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
};

/**
 * Simulates sending a deposit to a public authority for safekeeping. This
 * should be used if the law in your jurisdiction requires that rental
 * deposits be deposited with a governmental body (e.g. regional housing
 * agency). In production this would perform an HTTP request to the
 * authority's API or use another integration channel.
 *
 * @param contractId The ID of the contract for which the deposit is paid.
 * @param amount The amount of the deposit in EUR.
 */
export const depositToAuthority = async (contractId: string, amount: number): Promise<void> => {
  // TODO: integrate with the public authority's API here
  console.log(
    `Simulating deposit of €${amount} for contract ${contractId} to the public authority.`,
  );
  await new Promise(resolve => setTimeout(resolve, 500));
};