export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_API_URL || 
  (process.env.NODE_ENV === 'production' ? 'https://api.shitmarket.com' : 'http://localhost:3001');
