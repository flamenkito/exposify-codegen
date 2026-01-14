import * as fs from 'fs';
import * as path from 'path';
import { BaseGenerator, FILE_HEADER } from './base';
import { GeneratorOptions, ServiceMetadata } from '../types';

export class AngularGenerator extends BaseGenerator {
  readonly name = 'angular' as const;

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
      ? `import { ${Array.from(imports).join(', ')} } from '../models';`
      : '';

    return `import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { JsonRpcClient } from '../json-rpc.client';
${modelImports}

@Injectable({ providedIn: 'root' })
export class ${service.className} {
  constructor(private rpc: JsonRpcClient) {}

${methods}
}
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

    return `  ${method.name}(${params}): Observable<${method.returnType}> {
    return this.rpc.call<${method.returnType}>('${rpcMethod}'${rpcParams});
  }`;
  }

  private jsonRpcClientTemplate(endpoint: string): string {
    return `import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface JsonRpcRequest {
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

@Injectable({ providedIn: 'root' })
export class JsonRpcClient {
  private endpoint = '${endpoint}';
  private requestId = 0;

  constructor(private http: HttpClient) {}

  call<T>(method: string, params?: unknown): Observable<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    return this.http.post<JsonRpcResponse<T>>(this.endpoint, request).pipe(
      map((response) => {
        if (response.error) {
          throw new JsonRpcError(
            response.error.code,
            response.error.message,
            response.error.data
          );
        }
        return response.result as T;
      })
    );
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }
}
`;
  }
}
