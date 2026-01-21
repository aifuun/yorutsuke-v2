/**
 * Generic Lambda Event Types
 * Used by diagnostic Lambda (Lambda URL trigger)
 */

export interface LambdaEvent {
  body?: string | null;
  headers?: Record<string, string>;
  requestContext?: Record<string, unknown>;
  traceId?: string;
  [key: string]: unknown;
}

export interface LambdaContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis: () => number;
}

export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
