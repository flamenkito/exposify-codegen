export interface ServiceMetadata {
  className: string;
  methods: MethodMetadata[];
  sourceFile: string;
}

export interface MethodMetadata {
  name: string;
  parameters: ParameterMetadata[];
  returnType: string;
  decorators: DecoratorMetadata[];
}

export interface ParameterMetadata {
  name: string;
  type: string;
  isDto: boolean;
}

export interface DecoratorMetadata {
  name: string;
  arguments: string[];
}

export interface TypeMetadata {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'type-alias';
  properties: PropertyMetadata[];
  sourceFile: string;
  sourceCode: string;
}

export interface PropertyMetadata {
  name: string;
  type: string;
  optional: boolean;
}

export interface WorkspaceProject {
  name: string;
  srcPath: string;
}

export interface GeneratorOptions {
  inputs: string[];
  output: string;
  endpoint: string;
  target: GeneratorTarget;
  verbose?: boolean;
  workspaceProjects?: WorkspaceProject[];
}

export type GeneratorTarget = 'angular' | 'preact' | 'react' | 'fetch';

export interface ParseResult {
  services: ServiceMetadata[];
  types: TypeMetadata[];
}

export interface ClientGenerator {
  readonly name: GeneratorTarget;
  generate(result: ParseResult, options: GeneratorOptions): void;
}
