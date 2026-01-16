import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { apiClient } from 'lib/api';

export function useApi() {
  const { authenticated, ready, getAccessToken } = usePrivy();

  useEffect(() => {
    const updateToken = async () => {
      if (!ready) {
        console.log('⏳ Waiting for Privy...');
        return;
      }

      if (authenticated) {
        try {
          console.log('🔑 Getting token...');
          const token = await getAccessToken();
          apiClient.setToken(token);
          console.log('✅ Token initialized');
        } catch (error) {
          console.error('❌ Failed to get token:', error);
          apiClient.setToken(null); // Resolve anyway to prevent hanging
        }
      } else {
        console.log('🔓 Clearing token - user logged out'); // ADD THIS
        apiClient.setToken(null);
      }
    };

    updateToken();
  }, [authenticated, ready, getAccessToken]);

  return apiClient;
}