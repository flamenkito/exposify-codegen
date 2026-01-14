import * as fs from 'fs';
import * as path from 'path';
import { BaseGenerator, FILE_HEADER } from './base';
import { GeneratorOptions, ServiceMetadata } from '../types';

export class PreactGenerator extends BaseGenerator {
  readonly name = 'preact' as const;

  protected generateClient(output: string, options: GeneratorOptions): void {
    const code = this.jsonRpcClientTemplate(options.endpoint);
    fs.writeFileSync(path.join(output, 'json-rpc.client.ts'), FILE_HEADER + code);
    console.log('Generated: json-rpc.client.ts');
  }

  protected generateService(service: ServiceMetadata): string {
    const imports = this.collectServiceImports(service);
    const methods = service.methods
      .map((m) => this.generateMethod(service.className, m))
      .join('\n\n');

    const modelImports = imports.size > 0
      ? `import type { ${Array.from(imports).join(', ')} } from '../models';`
      : '';

    return `import { jsonRpcCall } from '../json-rpc.client';
${modelImports}

${methods}
`;
  }

  private generateMethod(
    className: string,
    method: { name: string; parameters: { name: string; type: string }[]; returnType: string }
  ): string {
    const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
    const rpcMethod = `${className}.${method.name}`;

    let rpcParams = '';
    if (method.parameters.length === 1) {
      rpcParams = `, ${method.parameters[0].name}`;
    } else if (method.parameters.length > 1) {
      const paramObj = method.parameters.map((p) => p.name).join(', ');
      rpcParams = `, { ${paramObj} }`;
    }

    return `export async function ${method.name}(${params}): Promise<${method.returnType}> {
  return jsonRpcCall<${method.returnType}>('${rpcMethod}'${rpcParams});
}`;
  }

  private jsonRpcClientTemplate(endpoint: string): string {
    return `export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id: number;
}

export interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number | null;
}

export class JsonRpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'JsonRpcError';
  }
}

let endpoint = '${endpoint}';
let requestId = 0;
let authToken: string | null = null;

export function setEndpoint(url: string): void {
  endpoint = url;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export async function jsonRpcCall<T>(method: string, params?: unknown): Promise<T> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method,
    params,
    id: ++requestId,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = \`Bearer \${authToken}\`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  const data: JsonRpcResponse<T> = await response.json();

  if (data.error) {
    throw new JsonRpcError(data.error.code, data.error.message, data.error.data);
  }

  return data.result as T;
}
`;
  }
}
