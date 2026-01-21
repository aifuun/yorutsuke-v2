/**
 * AWS S3 Event Types
 * Used by instant-processor Lambda (S3 ObjectCreated trigger)
 */

export interface S3Event {
  Records: S3EventRecord[];
}

export interface S3EventRecord {
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventTime: string;
  eventName: string;
  s3: {
    s3SchemaVersion: string;
    configurationId: string;
    bucket: {
      name: string;
      arn: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      sequencer: string;
    };
  };
}
