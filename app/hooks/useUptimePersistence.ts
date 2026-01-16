import { useState, useCallback } from 'react';
import { useSmartAccount } from './useMetamaskSmartAccount';
import { useDelegation } from './useDelegation';
import IPFSService, { type UptimeData } from '~/services/ipfsService';
import BundlerService from '~/services/bundlerService';
import { type Address } from 'viem';

export interface CheckInData {
  tasks: Array<{
    id: number;
    text: string;
    completed: boolean;
    hasBlocker: boolean;
  }>;
  energy: number;
  focusSeconds: number;
  uptime: number;
  lastBreak: number | null;
  analysis?: {
    suggestion: string;
    reasoning: string;
    needsBreak: boolean;
  };
}

export interface PersistenceState {
  isUploading: boolean;
  isRecording: boolean;
  lastCheckIn: string | null;
  error: string | null;
}

export function useUptimePersistence() {
  const { smartAccount, smartAccountAddress } = useSmartAccount();
  const { hasDelegation } = useDelegation();
  
  const [state, setState] = useState<PersistenceState>({
    isUploading: false,
    isRecording: false,
    lastCheckIn: null,
    error: null,
  });

  const bundlerService = new BundlerService();

  /**
   * Upload data to IPFS and record check-in on blockchain
   */
  const recordCheckIn = useCallback(async (
    data: CheckInData,
    contractAddress: Address,
    dataType: 'tasks' | 'analysis' | 'full' = 'full'
  ): Promise<string | null> => {
    if (!smartAccount || !smartAccountAddress) {
      setState(prev => ({ ...prev, error: 'Smart account not ready' }));
      return null;
    }

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      // 1. Upload data to IPFS
      const uptimeData: UptimeData = {
        ...data,
        timestamp: Date.now(),
      };

      const ipfsCID = await IPFSService.uploadUptimeData(uptimeData);
      console.log('✅ Data uploaded to IPFS:', ipfsCID);

      // 2. Record check-in on blockchain
      setState(prev => ({ ...prev, isRecording: true }));

      const transactionHash = await bundlerService.recordCheckIn(
        smartAccount,
        contractAddress,
        data.uptime,
        ipfsCID,
        dataType
      );

      console.log('✅ Check-in recorded on blockchain:', transactionHash);

      setState(prev => ({
        ...prev,
        isUploading: false,
        isRecording: false,
        lastCheckIn: ipfsCID,
        error: null,
      }));

      return ipfsCID;
    } catch (error) {
      console.error('Failed to record check-in:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        isRecording: false,
        error: error instanceof Error ? error.message : 'Check-in failed',
      }));
      return null;
    }
  }, [smartAccount, smartAccountAddress]);

  /**
   * Record check-in on behalf of another user (for AI agent with delegation)
   */
  const recordCheckInForUser = useCallback(async (
    userAddress: Address,
    data: CheckInData,
    contractAddress: Address,
    dataType: 'tasks' | 'analysis' | 'full' = 'full'
  ): Promise<string | null> => {
    if (!smartAccount || !hasDelegation) {
      setState(prev => ({ ...prev, error: 'Delegation required for this action' }));
      return null;
    }

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      // 1. Upload data to IPFS
      const uptimeData: UptimeData = {
        ...data,
        timestamp: Date.now(),
      };

      const ipfsCID = await IPFSService.uploadUptimeData(uptimeData);
      console.log('✅ Data uploaded to IPFS for user:', ipfsCID);

      // 2. Record check-in on blockchain on behalf of user
      setState(prev => ({ ...prev, isRecording: true }));

      const transactionHash = await bundlerService.recordCheckInForUser(
        smartAccount,
        contractAddress,
        userAddress,
        data.uptime,
        ipfsCID,
        dataType
      );

      console.log('✅ Check-in recorded for user:', transactionHash);

      setState(prev => ({
        ...prev,
        isUploading: false,
        isRecording: false,
        lastCheckIn: ipfsCID,
        error: null,
      }));

      return ipfsCID;
    } catch (error) {
      console.error('Failed to record check-in for user:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        isRecording: false,
        error: error instanceof Error ? error.message : 'Check-in for user failed',
      }));
      return null;
    }
  }, [smartAccount, hasDelegation]);

  /**
   * Upload only task data to IPFS
   */
  const uploadTaskData = useCallback(async (
    tasks: CheckInData['tasks']
  ): Promise<string | null> => {
    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const ipfsCID = await IPFSService.uploadTaskData(tasks);
      console.log('✅ Task data uploaded to IPFS:', ipfsCID);

      setState(prev => ({
        ...prev,
        isUploading: false,
        lastCheckIn: ipfsCID,
        error: null,
      }));

      return ipfsCID;
    } catch (error) {
      console.error('Failed to upload task data:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Task upload failed',
      }));
      return null;
    }
  }, []);

  /**
   * Upload only analysis data to IPFS
   */
  const uploadAnalysisData = useCallback(async (
    analysis: CheckInData['analysis']
  ): Promise<string | null> => {
    if (!analysis) return null;

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const ipfsCID = await IPFSService.uploadAnalysisData(analysis);
      console.log('✅ Analysis data uploaded to IPFS:', ipfsCID);

      setState(prev => ({
        ...prev,
        isUploading: false,
        lastCheckIn: ipfsCID,
        error: null,
      }));

      return ipfsCID;
    } catch (error) {
      console.error('Failed to upload analysis data:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Analysis upload failed',
      }));
      return null;
    }
  }, []);

  /**
   * Retrieve data from IPFS using CID
   */
  const retrieveData = useCallback(async (cid: string): Promise<UptimeData | null> => {
    try {
      const data = await IPFSService.retrieveUptimeData(cid);
      console.log('✅ Data retrieved from IPFS:', cid);
      return data;
    } catch (error) {
      console.error('Failed to retrieve data from IPFS:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Data retrieval failed',
      }));
      return null;
    }
  }, []);

  /**
   * Get IPFS gateway URL for viewing data
   */
  const getDataURL = useCallback((cid: string): string => {
    return IPFSService.getGatewayURL(cid);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    recordCheckIn,
    recordCheckInForUser,
    uploadTaskData,
    uploadAnalysisData,
    retrieveData,
    getDataURL,
    clearError,
    
    // Computed
    isReady: !!smartAccount && !!smartAccountAddress,
    canRecordForOthers: hasDelegation,
  };
}
