import { useState } from 'react';
import { parseEther } from 'viem';

export function useUserOperation(smartAccount) {
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const sendUserOperation = async (to: string, value: string, data = '0x') => {
    if (!smartAccount) {
      throw new Error('Smart account not initialized');
    }

    try {
      setIsSending(true);
      setError(null);

      const { account, bundlerClient } = smartAccount;

      // Estimate gas (adjust based on your bundler)
      const maxFeePerGas = BigInt(1000000000); // 1 gwei
      const maxPriorityFeePerGas = BigInt(1000000000); // 1 gwei

      // Send user operation
      const userOperationHash = await bundlerClient.sendUserOperation({
        account,
        calls: [
          {
            to,
            value: parseEther(value),
            data,
          },
        ],
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      // Wait for transaction receipt
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      setTxHash(receipt.receipt.transactionHash);
      return receipt;
    } catch (err) {
      console.error('Error sending user operation:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendUserOperation,
    isSending,
    txHash,
    error,
  };
}