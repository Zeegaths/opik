import { useState, useEffect } from 'react';
import { 
  createDelegationFramework,
  type Delegation
} from '@metamask/delegation-toolkit';
import { createPublicClient, http, type Address } from 'viem';
import { monadTestnet } from 'lib/delegation-framework/chain';

interface DelegationData {
  delegate: Address;
  delegator: Address;
  authority: string;
  caveats: any[];
  salt: bigint;
  signature: string;
}

export function useDelegation() {
  const [delegation, setDelegation] = useState<DelegationData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if delegation already exists (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aiDelegation');
      if (saved) {
        try {
          setDelegation(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved delegation');
        }
      }
    }
  }, []);

  const createDelegation = async (
    smartAccountAddress: Address,
    aiAgentAddress: Address,
    contractAddress: Address
  ) => {
    setIsCreating(true);
    setError(null);

    try {
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(),
      });

      const framework = await createDelegationFramework({
        chain: monadTestnet,
        transport: http(),
      });

      // Create delegation with caveats
      const delegationStruct = {
        delegate: aiAgentAddress, // AI agent's address
        delegator: smartAccountAddress, // User's smart account
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        caveats: [
          {
            // Limit to specific contract
            enforcer: contractAddress,
            terms: '0x' as `0x${string}`,
          },
        ],
        salt: BigInt(Date.now()),
        signature: '0x' as `0x${string}`,
      };

      // Sign the delegation
      const signedDelegation = await framework.signDelegation(delegationStruct);
      
      setDelegation(signedDelegation as any);
      
      // Store in localStorage (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.setItem('aiDelegation', JSON.stringify(signedDelegation));
      }

      console.log('✅ Delegation Created');
      
      return signedDelegation;
    } catch (err: any) {
      console.error('Failed to create delegation:', err);
      setError(err.message || 'Failed to create delegation');
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const revokeDelegation = () => {
    setDelegation(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aiDelegation');
    }
    console.log('✅ Delegation Revoked');
  };

  return {
    delegation,
    hasDelegation: !!delegation,
    isCreating,
    error,
    createDelegation,
    revokeDelegation,
  };
}