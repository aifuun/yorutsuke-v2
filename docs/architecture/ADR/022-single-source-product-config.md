# ADR-022: Single-Source Product Configuration

**Status**: Accepted
**Date**: 2026-01-27

## Context

When building software products that may rebrand or spawn variants, naming becomes a critical concern:

| Approach | Flexibility | Consistency | Risk |
|----------|-------------|-------------|------|
| Hardcoded names | ❌ Manual refactor | ❌ Drift | All 50+ files need updates |
| Config-driven (partial) | ⚠️ Some flexibility | ⚠️ Partial | Some places still hardcoded |
| Single-source config | ✅ One change updates all | ✅ Automatic | None - generator ensures sync |

Previous approach: Product name "Recie" and technical name "recie" scattered across:
- 50+ AWS resource definitions in CDK
- Database file names in Rust and TypeScript
- Storage keys in LocalStorage
- Log directory paths
- CloudFormation stack names
- Lambda function names

**Problem**: Rebranding requires manual updates in 50+ locations, with high risk of missing some.

## Decision

Adopt a **single-source configuration system** with three-tier naming separation:

### Tier 1: User-Visible Names (Brand Identity)
Names users see in UI, marketing materials, app menus.
- **Source**: `productName` in `product.config.json`
- **Examples**: "Recie", "レシエ" (Japanese)
- **Changes**: Frequently (rebranding, localization)

### Tier 2: Code Structure (Neutral Naming)
Class names, function names, file names that describe functional role.
- **Source**: Hardcoded in code
- **Examples**: `MainStack`, `AdminStack`, `app_lib`, `app-infra`
- **Changes**: Never (stable architecture)
- **Rationale**: Code structure describes function, not brand

### Tier 3: Runtime Resources (Config-Driven)
AWS resources, database files, storage keys that need product differentiation.
- **Source**: `technicalName` in `product.config.json`
- **Examples**: `recie-*-us-dev`, `recie.db`, `.recie/`
- **Changes**: Rarely (variants, forks)

## Architecture

### Single Configuration File

```json
{
  "productName": "Recie",
  "productNameJa": "レシエ",
  "technicalName": "recie",  // ← Single source of truth
  "version": "0.1.0",
  "identifier": "com.recie.app"
}
```

### Auto-Generation Script

`scripts/sync-product-config.js` generates 3 configuration files:

1. **Frontend TypeScript** (`app/src/generated/config.ts`)
   ```typescript
   export const DB_PRODUCTION = 'sqlite:recie.db';
   export const STORAGE_PREFIX = 'recie';
   export const LOG_DIRECTORY = '.recie';
   ```

2. **Infrastructure TypeScript** (`infra/lib/generated/config.ts`)
   ```typescript
   export const RESOURCE_PREFIX = 'recie';
   export function getS3BucketName(type, region, env, account) {
     return `${RESOURCE_PREFIX}-${type}-${region}-${env}-${account}`;
   }
   ```

3. **Rust Backend** (`app/src-tauri/src/generated/config.rs`)
   ```rust
   pub const DB_PRODUCTION: &str = "recie.db";
   pub const LOG_DIRECTORY: &str = ".recie";
   ```

### Naming Rules

#### Rule 1: User-Visible → From Config
```typescript
// ✅ CORRECT - Dynamic from config
<h1>{PRODUCT_NAME}</h1>  // Displays "Recie"
document.title = PRODUCT_NAME;

// ❌ WRONG - Hardcoded
<h1>Recie</h1>
```

#### Rule 2: Code Structure → Neutral Naming
```typescript
// ✅ CORRECT - Describes function, not brand
export class MainStack extends cdk.Stack { }
export class AdminStack extends cdk.Stack { }

// ❌ WRONG - Couples to brand
export class RecieStack extends cdk.Stack { }
export class YorutsukeStack extends cdk.Stack { }
```

**Industry Examples**:
- React codebase never changed when Facebook → Meta
- AWS CDK uses `Stack`, not `AmazonStack`
- Kubernetes uses `Cluster`, not `GoogleCluster`

#### Rule 3: Runtime Resources → Config Helpers
```typescript
// ✅ CORRECT - Uses helper from generated config
const bucket = new s3.Bucket(this, "ImageBucket", {
  bucketName: getS3BucketName("images", "us", env, account),
});

// ❌ WRONG - Hardcoded inline
bucketName: `recie-images-us-${env}-${account}`
```

#### Rule 4: Files & Directories → Derived from Config
```typescript
// ✅ CORRECT - From generated config
import { DB_PRODUCTION, LOG_DIRECTORY } from './generated/config';

const dbPath = DB_PRODUCTION;  // "recie.db"
const logPath = LOG_DIRECTORY;  // ".recie"

// ❌ WRONG - Hardcoded strings
const dbPath = "recie.db";
const logPath = ".recie";
```

#### Rule 5: AWS Resources → Consistent Prefix
All AWS resources use `RESOURCE_PREFIX` constant:
```typescript
// DynamoDB
tableName: getDynamoTableName("transactions", "us", env)
// → "recie-transactions-us-dev"

// Lambda
functionName: getLambdaFunctionName("presign", "us", env)
// → "recie-presign-us-dev"

// S3
bucketName: getS3BucketName("images", "us", env, account)
// → "recie-images-us-dev-696249060859"

// Cognito
userPoolName: getCognitoPoolName("users-us", env)
// → "recie-users-us-dev"
```

## Implementation

### Modified Files (32 files)
- `product.config.json` - Single source configuration
- `scripts/sync-product-config.js` - Auto-generation script
- `infra/lib/yorutsuke-stack.ts` → `main-stack.ts` (50+ resources)
- `infra/lib/yorutsuke-admin-stack.ts` → `admin-stack.ts` (15+ resources)
- `app/src-tauri/src/main.rs` - Updated lib reference
- `app/src-tauri/Cargo.toml` - Neutral lib name `app_lib`
- `app/src/00_kernel/storage/db.ts` - Uses generated config
- `app/src/01_domains/quota/LocalQuota.ts` - Uses generated config

### Generated Files (3 auto-generated)
- `app/src/generated/config.ts`
- `infra/lib/generated/config.ts`
- `app/src-tauri/src/generated/config.rs`

### Workflow Integration
```bash
# Development
npm run config:sync:dev        # Sync with dev environment
npm run dev:app                # Auto-syncs before starting

# Production
npm run config:sync            # Sync with production config
npm run build                  # Auto-syncs before building
```

## Consequences

### Positive
- ✅ **One change updates 50+ locations** - Change `technicalName`, regenerate configs
- ✅ **No drift** - Auto-generation ensures perfect consistency
- ✅ **Brand-agnostic code** - Stack classes never need renaming
- ✅ **Type-safe** - Generated TypeScript provides autocomplete
- ✅ **Easy variants** - Fork product with different `technicalName`
- ✅ **Clear separation** - User-facing vs. code structure vs. runtime resources

### Negative
- ⚠️ **Build step** - Must run `npm run config:sync` after changing config
- ⚠️ **Generated files** - 3 files auto-generated (but git-tracked for transparency)
- ⚠️ **Learning curve** - Team must understand three-tier naming

### Verified in Production
Deployed to AWS on 2026-01-27:
- ✅ 86 resources in `Recie2Stack-dev` (main stack)
- ✅ 67 resources in `Recie2AdminStack-dev` (admin stack)
- ✅ All resources using config-driven names:
  - 3 DynamoDB tables: `recie-*-us-dev`
  - 14 Lambda functions: `recie-*-us-dev`
  - 3 S3 buckets: `recie-*-us-dev-*`
  - 2 Cognito pools: `recie-*-us-dev`
  - 2 Lambda Layers: `recie-*-dev`

## Examples

### Example 1: Rebranding "Recie" → "RecieX"
```json
// product.config.json - ONE change
{
  "productName": "RecieX",
  "technicalName": "reciex"  // ← ONLY change needed
}
```

```bash
npm run config:sync         # Regenerates 3 files
npm run deploy              # Redeploys with new names
```

**Result**: All 50+ AWS resources automatically renamed to `reciex-*`

### Example 2: Creating a Fork/Variant
```bash
cp product.config.json product.config.fork.json

# Edit technicalName → "forkname"
vim product.config.fork.json

npm run config:sync         # Uses fork config
npm run deploy              # Separate AWS stack
```

**Result**: Parallel deployment with zero code changes

### Example 3: Stack Class Remains Neutral
```typescript
// Code NEVER changes, regardless of product name
export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Resource names from config
    const bucket = new s3.Bucket(this, "ImageBucket", {
      bucketName: getS3BucketName("images", "us", env, account),
    });
  }
}
```

**Benefit**: React didn't rename classes when Facebook → Meta

## Related

- [product.config.json](../../product.config.json) - Configuration source
- [scripts/sync-product-config.js](../../scripts/sync-product-config.js) - Generator
- [SINGLE_SOURCE_CONFIG.md](../dev/SINGLE_SOURCE_CONFIG.md) - Implementation guide
- Issue #167 - Single-source configuration implementation

---

*Established to enable product flexibility and eliminate naming drift*
