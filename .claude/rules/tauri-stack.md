# Tauri + React + AWS CDK Stack Rules

## Tauri (src-tauri/)

### Commands
- Use `#[tauri::command]` for IPC
- Return `Result<T, String>` for error handling
- Keep commands thin, delegate to services

### State Management
- Use `tauri::State<T>` for shared state
- Protect with `Mutex` or `RwLock`
- Avoid blocking the main thread

### Security
- Validate all IPC inputs
- Use allowlist for file/network access
- Never expose sensitive Rust APIs directly

## React Frontend (src/)

> Module structure: see `.prot/STRUCTURE.md`

### Headless Hooks
```typescript
// GOOD: Returns data + functions
function useCartLogic() {
  const [state, dispatch] = useReducer(reducer, 'idle');
  const addItem = (id: ItemId) => { ... };
  return { state, addItem };
}

// BAD: Returns JSX
function useCart() {
  return <div>Cart</div>; // FORBIDDEN in headless/
}
```

### Tauri IPC
```typescript
// adapters/fileIpc.ts
import { invoke } from '@tauri-apps/api/tauri';

export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path });
}
```

## AWS CDK (infra/)

> Directory structure: see `.prot/STRUCTURE.md`

### Naming Convention
- Stack: `{Project}{Env}Stack` (e.g., `MyAppProdStack`)
- Resources: kebab-case with env prefix

### Security
- Use Secrets Manager for credentials
- Enable encryption at rest
- Least privilege IAM policies

### Deployment
```bash
# Always diff first
cdk diff --profile dev

# Deploy with approval
cdk deploy --profile dev --require-approval broadening
```

## Cross-Layer Communication

```
┌──────────────┐     IPC      ┌──────────────┐
│    React     │ ◄──────────► │    Tauri     │
│  (Frontend)  │              │   (Rust)     │
└──────────────┘              └──────────────┘
       │                             │
       │ HTTP/WS                     │ SDK
       ▼                             ▼
┌──────────────────────────────────────────┐
│              AWS Backend                  │
│  (Lambda, API Gateway, DynamoDB, S3)     │
└──────────────────────────────────────────┘
```

## Environment Variables

```bash
# .env.local (gitignored)
VITE_API_URL=https://api.example.com
TAURI_PRIVATE_KEY=...

# Use in React
import.meta.env.VITE_API_URL

# Use in Tauri (build.rs or config)
std::env::var("TAURI_PRIVATE_KEY")
```
