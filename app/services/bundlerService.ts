import { createBundlerClient } from 'viem/account-abstraction';
import { createPublicClient, http, type Address } from 'viem';
import { monadTestnet } from 'lib/delegation-framework/chain';

// Bundler configuration for Monad testnet
const BUNDLER_CONFIG = {
  // Using a public bundler service (you may need to find a Monad-specific bundler)
  rpcUrl: 'https://bundler.example.com', // Replace with actual Monad bundler
  // Alternative: Use a paymaster service for gasless transactions
  paymasterUrl: 'https://paymaster.example.com', // Replace with actual paymaster
};

export interface UserOperation {
  to: Address;
  value: bigint;
  data: `0x${string}`;
}

export interface GasEstimate {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
}

export class BundlerService {
  private publicClient: any;
  private bundlerClient: any;

  constructor() {
    // Create public client for Monad testnet
    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    // Create bundler client
    this.bundlerClient = createBundlerClient({
      client: this.publicClient,
      transport: http(BUNDLER_CONFIG.rpcUrl),
    });
  }

  /**
   * Estimate gas for a user operation
   */
  async estimateGas(
    smartAccount: any,
    calls: UserOperation[]
  ): Promise<GasEstimate> {
    try {
      const estimate = await this.bundlerClient.estimateUserOperationGas({
        account: smartAccount,
        calls,
      });

      return {
        maxFeePerGas: estimate.maxFeePerGas,
        maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
        callGasLimit: estimate.callGasLimit,
        verificationGasLimit: estimate.verificationGasLimit,
        preVerificationGas: estimate.preVerificationGas,
      };
    } catch (error) {
      console.error('Gas estimation failed:', error);
      // Return default gas values as fallback
      return {
        maxFeePerGas: 1000000000n, // 1 gwei
        maxPriorityFeePerGas: 1000000000n, // 1 gwei
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 21000n,
      };
    }
  }

  /**
   * Send a user operation (gasless transaction)
   */
  async sendUserOperation(
    smartAccount: any,
    calls: UserOperation[],
    gasEstimate?: GasEstimate
  ): Promise<string> {
    try {
      // Use provided gas estimate or estimate gas
      const gas = gasEstimate || await this.estimateGas(smartAccount, calls);

      const userOperationHash = await this.bundlerClient.sendUserOperation({
        account: smartAccount,
        calls,
        maxFeePerGas: gas.maxFeePerGas,
        maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
        callGasLimit: gas.callGasLimit,
        verificationGasLimit: gas.verificationGasLimit,
        preVerificationGas: gas.preVerificationGas,
      });

      console.log('✅ User operation sent:', userOperationHash);
      return userOperationHash;
    } catch (error) {
      console.error('Failed to send user operation:', error);
      throw new Error('User operation failed');
    }
  }

  /**
   * Wait for user operation to be mined
   */
  async waitForUserOperation(userOperationHash: string): Promise<string> {
    try {
      const receipt = await this.bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      console.log('✅ User operation mined:', receipt.receipt.transactionHash);
      return receipt.receipt.transactionHash;
    } catch (error) {
      console.error('Failed to wait for user operation:', error);
      throw new Error('User operation receipt failed');
    }
  }

  /**
   * Send a contract interaction (record check-in)
   */
  async recordCheckIn(
    smartAccount: any,
    contractAddress: Address,
    score: number,
    ipfsCID: string,
    dataType: string
  ): Promise<string> {
    try {
      // Encode the function call
      const data = this.encodeRecordCheckIn(score, ipfsCID, dataType);

      const calls: UserOperation[] = [
        {
          to: contractAddress,
          value: 0n,
          data,
        },
      ];

      const userOperationHash = await this.sendUserOperation(smartAccount, calls);
      return await this.waitForUserOperation(userOperationHash);
    } catch (error) {
      console.error('Failed to record check-in:', error);
      throw new Error('Check-in recording failed');
    }
  }

  /**
   * Send a contract interaction on behalf of another user (AI agent)
   */
  async recordCheckInForUser(
    smartAccount: any,
    contractAddress: Address,
    userAddress: Address,
    score: number,
    ipfsCID: string,
    dataType: string
  ): Promise<string> {
    try {
      // Encode the function call for recording on behalf of user
      const data = this.encodeRecordCheckInForUser(userAddress, score, ipfsCID, dataType);

      const calls: UserOperation[] = [
        {
          to: contractAddress,
          value: 0n,
          data,
        },
      ];

      const userOperationHash = await this.sendUserOperation(smartAccount, calls);
      return await this.waitForUserOperation(userOperationHash);
    } catch (error) {
      console.error('Failed to record check-in for user:', error);
      throw new Error('Check-in recording for user failed');
    }
  }

  /**
   * Encode recordCheckIn function call
   */
  private encodeRecordCheckIn(
    score: number,
    ipfsCID: string,
    dataType: string
  ): `0x${string}` {
    // This would typically use a contract ABI encoder
    // For now, we'll return a placeholder
    // In a real implementation, you'd use viem's encodeFunctionData
    return `0x${score.toString(16).padStart(2, '0')}${ipfsCID}${dataType}` as `0x${string}`;
  }

  /**
   * Encode recordCheckInForUser function call
   */
  private encodeRecordCheckInForUser(
    userAddress: Address,
    score: number,
    ipfsCID: string,
    dataType: string
  ): `0x${string}` {
    // This would typically use a contract ABI encoder
    // For now, we'll return a placeholder
    return `0x${userAddress}${score.toString(16).padStart(2, '0')}${ipfsCID}${dataType}` as `0x${string}`;
  }

  /**
   * Get user operation status
   */
  async getUserOperationStatus(userOperationHash: string): Promise<{
    status: 'pending' | 'mined' | 'failed';
    transactionHash?: string;
    error?: string;
  }> {
    try {
      const receipt = await this.bundlerClient.getUserOperationReceipt({
        hash: userOperationHash,
      });

      if (receipt) {
        return {
          status: 'mined',
          transactionHash: receipt.receipt.transactionHash,
        };
      } else {
        return {
          status: 'pending',
        };
      }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default BundlerService;
