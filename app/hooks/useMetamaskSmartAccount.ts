import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createBundlerClient } from 'viem/account-abstraction';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { useWallets } from '@privy-io/react-auth';

// ✅ ADD enabled parameter here
export default function useMetaMaskSmartAccount(enabled: boolean = true) {
  const { wallets } = useWallets();
  const [smartAccount, setSmartAccount] = useState(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState(null);

  const connectedWallet = wallets[0];

  // ✅ Single useEffect with enabled check at the top
  useEffect(() => {
    // ✅ Check if feature is enabled first
    if (!enabled) {
      console.log('⏭️ Smart account disabled for this wallet type');
      return;
    }

    // ✅ Then check if wallet is connected
    if (!connectedWallet) {
      console.log('⏳ No wallet connected yet');
      return;
    }

    console.log('✅ Creating smart account for MetaMask user');

    const setupSmartAccount = async () => {
      try {
        setIsCreatingAccount(true);
        setError(null);

        // 1. Set up Public Client
        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http(),
        });

        // 2. Set up Bundler Client
        const bundlerClient = createBundlerClient({
          client: publicClient,
          transport: http(
            import.meta.env.VITE_BUNDLER_RPC_URL ||
            'https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44'
          ),
        });

        // 3. Get the wallet provider from Privy
        const provider = await connectedWallet.getEthereumProvider();

        // 4. Create wallet client
        const walletClient = createWalletClient({
          chain: sepolia,
          transport: custom(provider),
        });

        // Get accounts
        const [address] = await walletClient.getAddresses();

        // 5. Create MetaMask Smart Account
        const account = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [address, [], [], []],
          deploySalt: '0x',
          signer: {
            account: {
              address,
              type: 'json-rpc',
            },
            client: walletClient,
          },
        });

        setSmartAccount({
          account,
          publicClient,
          bundlerClient,
          eoaAddress: address,
          smartAccountAddress: account.address,
        });
      } catch (err) {
        console.error('Error creating smart account:', err);
        setError(err.message);
      } finally {
        setIsCreatingAccount(false);
      }
    };

    setupSmartAccount();
  }, [connectedWallet, enabled]); // ✅ Add enabled to dependencies

  return {
    smartAccount,
    isCreatingAccount,
    error,
  };
}