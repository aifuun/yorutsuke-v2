/**
 * AWS Lambda Event Types
 * API Gateway v2 HTTP API events
 */

export interface APIGatewayProxyEventV2 {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  requestContext: {
    accountId?: string;
    apiId?: string;
    domainName?: string;
    domainPrefix?: string;
    http: {
      method: string;
      path: string;
      protocol?: string;
      sourceIp?: string;
      userAgent?: string;
    };
    requestId: string;
    routeKey?: string;
    stage?: string;
    time?: string;
    timeEpoch?: number;
    identity?: {
      userArn?: string;
      [key: string]: any;
    };
  };
  body?: string;
  isBase64Encoded: boolean;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  stageVariables?: Record<string, string>;
}

export interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}
