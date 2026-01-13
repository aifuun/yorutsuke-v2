# ADR-012: Bedrock Inference Profile IDs and Call Methods

**Date**: 2026-01-13
**Status**: ACTIVE
**Context**: Document available LLM models on Bedrock and how to invoke them

---

## Summary

All LLM models on AWS Bedrock are accessed via **Inference Profiles**. This ADR documents:
1. How to call Bedrock models
2. Model naming convention
3. Key models available for Yorutsuke

---

## How to Call Bedrock Models

### API Call Method

Use AWS Bedrock `InvokeModel` API with inference profile IDs:

```typescript
// TypeScript / Node.js
const bedrockClient = new BedrockRuntime({ region: 'us-east-1' });

const response = await bedrockClient.invokeModel({
  modelId: 'us.anthropic.claude-opus-4-5-20251101-v1:0',  // Inference Profile ID
  contentType: 'application/json',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 1000
  })
});
```

### Inference Profile ID Format

```
[SCOPE].[PROVIDER].[MODEL_NAME]-[VERSION]:0

Examples:
- us.anthropic.claude-opus-4-5-20251101-v1:0        (US region only)
- global.anthropic.claude-opus-4-5-20251101-v1:0    (Global - all regions)
- us.amazon.nova-lite-v1:0                          (US region only)
```

**Scope**:
- `us` - US regions only (us-east-1, us-east-2, us-west-2)
- `global` - All supported AWS regions

---

## Key Models for Yorutsuke

### Receipt OCR (Current)

```
inferenceProfileId: us.amazon.nova-lite-v1:0
modelArn: arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0
Purpose: Receipt image OCR processing (~¥0.015/image)
Status: ACTIVE
```

### General Purpose LLM

**Claude 3.5 Sonnet v2** (Recommended for balancing quality and cost)
```
inferenceProfileId: us.anthropic.claude-3-5-sonnet-20241022-v2:0
regions: us-east-1, us-east-2, us-west-2
Status: ACTIVE
```

**Claude Opus 4.5** (Most capable)
```
inferenceProfileId: us.anthropic.claude-opus-4-5-20251101-v1:0
regions: us-east-1, us-east-2, us-west-2
Status: ACTIVE
Global: global.anthropic.claude-opus-4-5-20251101-v1:0
```

**Claude Haiku 4.5** (Fast and cheap)
```
inferenceProfileId: us.anthropic.claude-haiku-4-5-20251001-v1:0
regions: us-east-1, us-east-2, us-west-2
Status: ACTIVE
Global: global.anthropic.claude-haiku-4-5-20251001-v1:0
```

### Other Providers

- **Meta Llama 3.3 70B**: `us.meta.llama3-3-70b-instruct-v1:0`
- **Amazon Nova Pro**: `us.amazon.nova-pro-v1:0`
- **DeepSeek R1**: `us.deepseek.r1-v1:0`

---

## Complete Model List Command

To get the latest available models:

```bash
aws bedrock list-inference-profiles --region us-east-1 --profile dev
```

Output format:
```json
{
  "inferenceProfileSummaries": [
    {
      "inferenceProfileId": "us.amazon.nova-lite-v1:0",
      "inferenceProfileName": "US Nova Lite",
      "status": "ACTIVE",
      "models": [
        {
          "modelArn": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
        }
      ]
    }
  ]
}
```

---

## Implementation Notes

### Region Availability

- **US Profiles** (us-*): Use `us.XXX.XXX-v1:0` format
- **Global Profiles**: Use `global.XXX.XXX-v1:0` format (routes to closest region automatically)

### Pricing Note

As of 2026-01-13:
- Nova Lite: ¥0.015/image (receipt OCR, most cost-effective)
- Claude Haiku 4.5: Cheapest LLM option
- Claude 3.5 Sonnet: Good balance of quality/cost
- Claude Opus 4.5: Most capable (highest cost)

### API Response Format

```typescript
interface BedrockResponse {
  modelId: string;                 // Echo of called model
  contentType: string;             // application/json
  body: ReadableStream<Uint8Array>; // UTF-8 encoded response
}

// For Claude models, parse body as:
{
  "type": "message",
  "content": [
    {
      "type": "text",
      "text": "Response text here"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null
}
```

---

## Related

- **Usage**: Receipt processing with Nova Lite (`amazon.nova-lite-v1:0`)
- **Cost tracking**: Implement cost monitoring per model
- **Region selection**: Always check latest profiles before hardcoding model IDs

---

**Last Updated**: 2026-01-13
**Profile Update Source**: `aws bedrock list-inference-profiles --region us-east-1 --profile dev`
