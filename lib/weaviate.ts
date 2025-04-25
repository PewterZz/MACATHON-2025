// Mark this file as server-only to prevent client-side inclusion
import 'server-only';

// Create a singleton for the Weaviate client
let weaviateClientInstance: any = null;

/**
 * Creates or returns the Weaviate client singleton.
 * This function should only be called on the server side.
 */
export const getWeaviateClient = async () => {
  // If we've already created the client, return it
  if (weaviateClientInstance) {
    return weaviateClientInstance;
  }
  
  // Check if we're in a server environment
  if (typeof window !== 'undefined') {
    console.error('Weaviate client cannot be initialized on the client side');
    throw new Error('Weaviate client must only be used on the server');
  }
  
  try {
    // Check for required environment variables
    if (!process.env.WEAVIATE_HOST) {
      console.warn('WEAVIATE_HOST environment variable is not set');
    }
    
    // Dynamically import weaviate-ts-client to avoid client-side loading issues
    const weaviate = await import('weaviate-ts-client');
    
    // Initialize the client
    weaviateClientInstance = weaviate.default.client({
      scheme: process.env.WEAVIATE_SCHEME || 'https',
      host: process.env.WEAVIATE_HOST || 'localhost:8080',
      apiKey: process.env.WEAVIATE_API_KEY ? 
        new weaviate.default.ApiKey(process.env.WEAVIATE_API_KEY) : 
        undefined,
    });
    
    return weaviateClientInstance;
  } catch (error) {
    console.error('Error initializing Weaviate client:', error);
    throw new Error('Failed to initialize Weaviate client');
  }
};

/**
 * Stores a conversation in Weaviate
 */
export const storeConversation = async (options: {
  className: string,
  data: {
    [key: string]: any,
    timestamp?: string
  }
}) => {
  try {
    const { className, data } = options;
    
    // Add timestamp if not provided
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    
    // Get Weaviate client
    const client = await getWeaviateClient();
    
    // Create schema class if it doesn't exist
    try {
      // This would need to be customized based on your schema needs
      // This is just a simplified example
      await client.schema.classCreator().withClass({
        class: className,
        properties: Object.keys(data).map(key => ({
          name: key,
          dataType: key === 'timestamp' ? ['date'] : ['text'],
        })),
      }).do();
    } catch (e) {
      // Class might already exist, which is fine
      console.log(`Schema class ${className} might already exist`);
    }
    
    // Store the data
    await client.data.creator()
      .withClassName(className)
      .withProperties(data)
      .do();
    
    console.log(`Stored conversation in Weaviate with class ${className}`);
    return true;
  } catch (error) {
    console.error('Error storing conversation in Weaviate:', error);
    // Don't throw the error, just log it and return false
    // This prevents Weaviate issues from breaking the main application flow
    return false;
  }
}; 