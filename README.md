<div align="center">
  <img src="docs/assets/logo_icon_transparent_1024.png" alt="exposify-codegen Logo" width="128">
  <h1>exposify-codegen</h1>
  <p><strong>Generate typed clients from NestJS @Expose decorated services</strong></p>
</div>

Generate typed multi-transport clients from NestJS `@Expose` decorated services.

## Features

- **Workspace Aware** - Automatically detects npm/yarn/pnpm workspaces and resolves project names
- **AST-Based Parsing** - Uses ts-morph for accurate TypeScript parsing
- **Multiple Targets** - Generate clients for Angular, React, and more (coming soon)
- **Type Safety** - Preserves TypeScript types, interfaces, and DTOs
- **JSON-RPC Transport** - Built-in support for JSON-RPC 2.0 protocol
- **Automatic Model Generation** - Extracts and generates all referenced types

## Installation

```bash
npm install -g exposify-codegen
# or
npm install -D exposify-codegen
# or use via npx
npx exposify-codegen --help
```

## CLI Usage

```bash
# Generate Angular client from workspace projects
exposify-codegen api auth -t angular -o ./generated

# Generate Preact client
exposify-codegen api -t preact -o ./generated

# Output to current directory (default)
exposify-codegen api -t angular

# Custom endpoint
exposify-codegen api -t angular -o ./generated -e /api/rpc

# Specify workspace root explicitly
exposify-codegen api -t angular --root /path/to/workspace -o ./generated
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `<projects...>` | Workspace project names to scan (e.g., `api auth`) | (required) |
| `-o, --output <path>` | Output directory for generated code | `.` (current dir) |
| `-e, --endpoint <path>` | JSON-RPC endpoint path | `/rpc/v1` |
| `-t, --target <target>` | Target framework (required) | - |
| `-r, --root <path>` | Workspace root directory | (auto-detected) |

## Supported Targets

| Target | Status | Description |
|--------|--------|-------------|
| `angular` | Available | Angular services with HttpClient and RxJS |
| `preact` | Available | Preact/React async functions with fetch |
| `react` | Planned | React hooks with fetch/axios |
| `fetch` | Planned | Framework-agnostic fetch client |

## How It Works

exposify-codegen scans your NestJS source files for services decorated with `@Expose()` and generates typed multi-transport client code.

### Input (NestJS)

```typescript
import { Injectable } from '@nestjs/common';
import { Expose } from 'nestjs-exposify';

@Expose({ transport: 'json-rpc' })
@Injectable()
export class UsersService {
  async getUsers(): Promise<UserDto[]> {
    // ...
  }

  async createUser(dto: CreateUserDto): Promise<UserDto> {
    // ...
  }
}
```

### Output (Angular)

```typescript
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private rpc: JsonRpcClient) {}

  getUsers(): Observable<UserDto[]> {
    return this.rpc.call<UserDto[]>('UsersService.getUsers');
  }

  createUser(dto: CreateUserDto): Observable<UserDto> {
    return this.rpc.call<UserDto>('UsersService.createUser', dto);
  }
}
```

## Generated Output Structure

```
generated/
├── json-rpc.client.ts      # JSON-RPC client implementation
├── services/
│   ├── users-service.service.ts
│   ├── auth-service.service.ts
│   └── index.ts
├── models/
│   ├── user-dto.ts
│   ├── create-user-dto.ts
│   └── index.ts
└── index.ts
```

## Integration with workgraph

For automatic client generation during builds, use [workgraph](https://github.com/tks2a/workgraph) with source configuration.

Add to your root `package.json`:

```json
{
  "workgraph": {
    "sources": {
      "apps/web-angular/src/generated": "npx exposify-codegen api -t angular -o ./apps/web-angular/src/generated"
    }
  }
}
```

Now when you run `workgraph build` or `workgraph watch`, the client is automatically regenerated before building projects that depend on it.

```bash
$ workgraph build -c api
[14:32:01] Generating: apps/web-angular/src/generated
[14:32:03]   Generated successfully
[14:32:03] Building: @myorg/api
...
```

## Programmatic API

```typescript
import {
  Generator,
  Parser,
  loadWorkspaceProjects,
  resolveProjectNames,
  findWorkspaceRoot,
} from 'exposify-codegen';

// Using workspace helpers
const root = findWorkspaceRoot(process.cwd());
const projects = await loadWorkspaceProjects(root);
const resolved = resolveProjectNames(['api', 'auth'], projects);
const inputs = resolved.map(p => p.srcPath);

// Using the high-level Generator
const generator = new Generator();
generator.generate({
  inputs,
  output: './generated',
  endpoint: '/rpc/v1',
  target: 'angular',
});

// Using the Parser directly
const parser = new Parser();
const result = parser.parse(inputs);
console.log(result.services); // ServiceMetadata[]
console.log(result.types);    // TypeMetadata[]
```

## Creating Custom Generators

Extend `BaseGenerator` to create custom output targets:

```typescript
import { BaseGenerator, GeneratorOptions, ServiceMetadata } from 'exposify-codegen';

export class MyCustomGenerator extends BaseGenerator {
  readonly name = 'custom' as const;

  protected generateClient(output: string, options: GeneratorOptions): void {
    // Generate your client infrastructure
  }

  protected generateService(service: ServiceMetadata): string {
    // Generate service code for your target framework
    return `// Custom service code for ${service.className}`;
  }
}
```

## Requirements

- Node.js >= 18.0.0
- NestJS services decorated with `@Expose({ transport: 'json-rpc' })`

## Publishing

See [RELEASING.md](./RELEASING.md) for publishing instructions.

## License

MIT
