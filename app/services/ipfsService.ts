import { create } from 'ipfs-http-client';

// IPFS configuration
const IPFS_CONFIG = {
  // Using Infura IPFS gateway (free tier available)
  url: 'https://ipfs.infura.io:5001/api/v0',
  // Alternative: Pinata IPFS
  // url: 'https://api.pinata.cloud',
  // headers: {
  //   'pinata_api_key': process.env.PINATA_API_KEY,
  //   'pinata_secret_api_key': process.env.PINATA_SECRET_KEY,
  // }
};

// Initialize IPFS client
let ipfsClient: any = null;

const getIPFSClient = () => {
  if (!ipfsClient) {
    try {
      ipfsClient = create(IPFS_CONFIG);
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      throw new Error('IPFS client initialization failed');
    }
  }
  return ipfsClient;
};

export interface UptimeData {
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
  timestamp: number;
  analysis?: {
    suggestion: string;
    reasoning: string;
    needsBreak: boolean;
  };
}

export class IPFSService {
  /**
   * Upload uptime data to IPFS
   */
  static async uploadUptimeData(data: UptimeData): Promise<string> {
    try {
      const client = getIPFSClient();
      
      // Convert data to JSON string
      const jsonData = JSON.stringify(data, null, 2);
      
      // Add to IPFS
      const result = await client.add(jsonData);
      
      console.log('✅ Data uploaded to IPFS:', result.path);
      return result.path;
    } catch (error) {
      console.error('Failed to upload to IPFS:', error);
      throw new Error('IPFS upload failed');
    }
  }

  /**
   * Retrieve uptime data from IPFS using CID
   */
  static async retrieveUptimeData(cid: string): Promise<UptimeData | null> {
    try {
      const client = getIPFSClient();
      
      // Get data from IPFS
      const chunks = [];
      for await (const chunk of client.cat(cid)) {
        chunks.push(chunk);
      }
      
      // Combine chunks and parse JSON
      const data = Buffer.concat(chunks).toString();
      const parsedData = JSON.parse(data) as UptimeData;
      
      console.log('✅ Data retrieved from IPFS:', cid);
      return parsedData;
    } catch (error) {
      console.error('Failed to retrieve from IPFS:', error);
      return null;
    }
  }

  /**
   * Upload task data specifically
   */
  static async uploadTaskData(tasks: UptimeData['tasks']): Promise<string> {
    const data: UptimeData = {
      tasks,
      energy: 0,
      focusSeconds: 0,
      uptime: 0,
      lastBreak: null,
      timestamp: Date.now(),
    };
    
    return this.uploadUptimeData(data);
  }

  /**
   * Upload analysis data
   */
  static async uploadAnalysisData(analysis: UptimeData['analysis']): Promise<string> {
    const data: UptimeData = {
      tasks: [],
      energy: 0,
      focusSeconds: 0,
      uptime: 0,
      lastBreak: null,
      timestamp: Date.now(),
      analysis,
    };
    
    return this.uploadUptimeData(data);
  }

  /**
   * Get IPFS gateway URL for viewing data
   */
  static getGatewayURL(cid: string): string {
    // Using public IPFS gateway
    return `https://ipfs.io/ipfs/${cid}`;
  }

  /**
   * Get Infura IPFS gateway URL (faster)
   */
  static getInfuraGatewayURL(cid: string): string {
    return `https://ipfs.infura.io/ipfs/${cid}`;
  }

  /**
   * Validate CID format
   */
  static isValidCID(cid: string): boolean {
    // Basic CID validation (starts with Qm for v0 or bafy for v1)
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52})$/.test(cid);
  }
}

export default IPFSService;
