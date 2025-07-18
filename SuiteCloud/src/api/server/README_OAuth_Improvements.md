# Improved OAuth and API Management

This document explains the improvements made to the OAuth token management system and API utilities to prevent execution stalls and provide robust error handling.

## Overview of Problems in Original Implementation

The original `authServer.ts` had several critical issues:

1. **Race Conditions**: Multiple concurrent requests could trigger parallel token refresh attempts
2. **Inconsistent State**: Global `infoLogs` array and lack of proper state management
3. **No Retry Logic**: Network failures would immediately fail without retry attempts
4. **Token Validation Issues**: Insufficient validation of token expiration and freshness
5. **Error Handling**: Poor error recovery that could leave the system in inconsistent states
6. **Resource Leaks**: Express servers not properly cleaned up

## New Implementation: `AuthManager.ts`

### Key Improvements

#### 1. **Robust State Management**
- **Token Status Tracking**: Comprehensive token metadata with status, expiration, refresh count, and error tracking
- **Authentication State**: Clear state machine (`IDLE`, `REFRESHING`, `AUTHORIZING`, `ERROR`)
- **Persistent Metadata**: Token metadata stored in `token_metadata.json` for reliability across restarts

#### 2. **Request Queueing System**
- **Concurrent Request Handling**: Multiple requests for tokens are queued instead of triggering parallel refresh attempts
- **Timeout Management**: Queued requests are automatically cleaned up after 2 minutes
- **Graceful Resolution**: All pending requests receive the same fresh token when ready

#### 3. **Advanced Retry Logic**
- **Exponential Backoff**: Intelligent retry delays with jitter to avoid thundering herd
- **Configurable Retries**: Customizable retry counts, delays, and conditions
- **Network Resilience**: Automatic retry for network errors, timeouts, and transient failures

#### 4. **Enhanced Token Validation**
- **Buffer Time**: Tokens are considered expired 5 minutes before actual expiration
- **Background Validation**: Periodic token validation every 30 seconds
- **Multi-source Token Loading**: Intelligently selects the best available token from STEP2/STEP3 files

#### 5. **Comprehensive Error Handling**
- **Error Classification**: Distinguishes between retryable errors, token errors, and permanent failures
- **Detailed Logging**: Structured error logging with context and attempt information
- **Graceful Degradation**: System continues operating even after partial failures

#### 6. **Resource Management**
- **Automatic Cleanup**: Proper server shutdown and resource cleanup
- **Process Exit Handlers**: Graceful shutdown on SIGINT/SIGTERM
- **Memory Management**: Controlled memory usage with request queue limits

### Usage Examples

#### Basic Usage (Drop-in replacement)
```typescript
import { getAccessToken } from './server/AuthManager';

// Simple usage - handles all complexity internally
const token = await getAccessToken();
```

#### Advanced Usage with Custom Configuration
```typescript
import { RobustOAuthManager } from './server/AuthManager';

const oauthManager = new RobustOAuthManager({
    maxRetries: 5,
    retryDelayMs: 2000,
    tokenBufferMs: 10 * 60 * 1000, // 10 minute buffer
    validationIntervalMs: 60 * 1000, // 1 minute validation
    enableQueueing: true
});

const token = await oauthManager.getAccessToken();
```

#### Status Monitoring
```typescript
import { getOAuthStatus, validateToken } from './server/AuthManager';

// Check current OAuth status
const status = getOAuthStatus();
console.log('State:', status.state);
console.log('Has Valid Token:', status.hasValidToken);
console.log('Pending Requests:', status.pendingRequests);

// Validate current token
const isValid = await validateToken();
console.log('Token is valid:', isValid);
```

## Improved API Utilities: `putImproved.ts`

### Key Improvements

#### 1. **Intelligent Token Management**
- **Automatic Token Refresh**: Detects 401/403 errors and automatically refreshes tokens
- **Token Caching**: Reuses fresh tokens across requests to minimize refresh calls
- **Token Error Detection**: Specifically handles token-related errors separately from network errors

#### 2. **Robust Retry Logic**
- **Error Classification**: Distinguishes between retryable and non-retryable errors
- **Exponential Backoff**: Smart retry delays with jitter
- **Configurable Retry Options**: Customizable retry behavior per request

#### 3. **Enhanced Batch Processing**
- **Failure Tolerance**: Continues processing even if some batches fail
- **Progress Monitoring**: Detailed logging of batch progress and statistics
- **Intelligent Delays**: Longer delays after failures to prevent cascading issues

#### 4. **Comprehensive Error Reporting**
- **Structured Error Logging**: Detailed error information with context
- **Error Persistence**: Failed requests saved to disk for debugging
- **Performance Metrics**: Request timing and success rate tracking

### Usage Examples

#### Basic PUT Request
```typescript
import { PUT } from './utils/api/putImproved';

const response = await PUT(
    accessToken,
    scriptId,
    deployId,
    payload,
    AxiosContentTypeEnum.JSON
);
```

#### Batch Upsert with Improved Error Handling
```typescript
import { upsertRecordPayload } from './utils/api/putImproved';

const responses = await upsertRecordPayload({
    postOptions: recordArray,
    responseOptions: { /* options */ }
});

// Handles batching, retries, and token refresh automatically
```

#### Custom Retry Logic
```typescript
import { putWithCustomRetry } from './utils/api/putImproved';

const response = await putWithCustomRetry({
    scriptId: 123,
    deployId: 1,
    payload: data,
    maxRetries: 5,
    retryCondition: (error, attempt) => {
        // Custom retry logic
        return error.response?.status === 429 || attempt < 3;
    },
    onRetry: (error, attempt) => {
        console.log(`Retrying request (attempt ${attempt}):`, error.message);
    }
});
```

## Configuration Options

### OAuth Manager Options
```typescript
interface AuthOptions {
    maxRetries?: number;           // Default: 3
    retryDelayMs?: number;         // Default: 1000ms
    tokenBufferMs?: number;        // Default: 5 minutes
    validationIntervalMs?: number; // Default: 30 seconds
    enableQueueing?: boolean;      // Default: true
}
```

### API Retry Options
```typescript
const API_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffFactor: 2
};
```

## Migration Guide

### From Original authServer.ts

1. **Replace imports**:
   ```typescript
   // Old
   import { getAccessToken } from './server/authServer';
   
   // New
   import { getAccessToken } from './server/AuthManager';
   ```

2. **Remove manual token refresh logic** - now handled automatically

3. **Remove CLOSE_SERVER() calls** - now handled automatically

4. **Update error handling** to handle the new structured errors

### From Original put.ts

1. **Replace imports**:
   ```typescript
   // Old
   import { PUT, upsertRecordPayload } from './utils/api/put';
   
   // New
   import { PUT, upsertRecordPayload } from './utils/api/putImproved';
   ```

2. **Remove manual token refresh logic** - now handled in PUT function

3. **Update error handling** to use the new error structure

## Best Practices

### 1. **Use getAccessToken() Everywhere**
Always use the centralized `getAccessToken()` function instead of managing tokens manually:

```typescript
// Good
const token = await getAccessToken();
const response = await PUT(token, scriptId, deployId, payload);

// Avoid
const tokenResponse = read(STEP2_TOKENS_PATH);
const token = tokenResponse.access_token; // May be expired
```

### 2. **Handle Errors Gracefully**
Use try-catch blocks and handle different error types appropriately:

```typescript
try {
    const token = await getAccessToken();
    const response = await PUT(token, scriptId, deployId, payload);
    return response.data;
} catch (error) {
    if (error.message.includes('Token refresh failed')) {
        // Handle authentication issues
        console.error('Authentication problem:', error.message);
    } else if (error.message.includes('after retries')) {
        // Handle network/API issues
        console.error('API unavailable:', error.message);
    } else {
        // Handle other errors
        console.error('Unexpected error:', error.message);
    }
    throw error;
}
```

### 3. **Monitor OAuth Status**
Regularly check OAuth status in long-running applications:

```typescript
setInterval(async () => {
    const status = getOAuthStatus();
    if (status.state === 'ERROR' || !status.hasValidToken) {
        console.warn('OAuth issues detected:', status);
    }
}, 60000); // Check every minute
```

### 4. **Use Batch Operations**
For multiple records, always use batch operations:

```typescript
// Good
const responses = await upsertRecordPayload({
    postOptions: records, // Array of records
    responseOptions: options
});

// Avoid
for (const record of records) {
    await PUT(token, scriptId, deployId, { postOptions: [record] });
}
```

## Monitoring and Debugging

### 1. **Log Analysis**
The improved system provides structured logging:

```
[RobustOAuthManager] Token refresh successful
[PUT] Success on attempt 1
[upsertRecordPayload] Processing 500 records in 5 batches
[upsertRecordPayload] Batch 1/5 completed: 100/100 successful
```

### 2. **Error Files**
Failed requests are automatically saved to the error directory:
- `ERROR_PUT_exhausted_retries.json` - API requests that failed after all retries
- `ERROR_upsertRecordPayload_batch_X.json` - Batch processing failures
- Token metadata in `token_metadata.json`

### 3. **Health Checks**
Implement health checks using the status functions:

```typescript
async function healthCheck() {
    const status = getOAuthStatus();
    const tokenValid = await validateToken();
    
    return {
        oauth: {
            state: status.state,
            hasValidToken: status.hasValidToken,
            pendingRequests: status.pendingRequests,
            tokenValid
        },
        timestamp: new Date().toISOString()
    };
}
```

## Troubleshooting

### Common Issues

1. **"All batches failed"**
   - Check network connectivity
   - Verify NetSuite credentials
   - Check rate limiting

2. **"Token refresh failed"**
   - Verify OAuth credentials in environment variables
   - Check if refresh token has expired
   - Ensure proper redirect URI configuration

3. **"Request timeout"**
   - Check if NetSuite is experiencing issues
   - Verify server resources
   - Consider increasing timeout values

### Performance Tuning

1. **Adjust batch sizes** based on payload complexity
2. **Tune retry delays** for your network conditions
3. **Configure token buffer time** based on request frequency
4. **Enable/disable queueing** based on concurrency needs

## Conclusion

The improved OAuth and API management system provides:

- ✅ **Robust error handling** with automatic recovery
- ✅ **Intelligent retry logic** with exponential backoff
- ✅ **Concurrent request handling** with queueing
- ✅ **Comprehensive monitoring** and debugging tools
- ✅ **Backward compatibility** with existing code
- ✅ **Production-ready reliability** with proper resource management

This implementation eliminates the common issues that caused execution stalls and provides a solid foundation for reliable API integrations.
