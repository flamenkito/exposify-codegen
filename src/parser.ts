import { Project, ClassDeclaration, MethodDeclaration, Type, SourceFile, InterfaceDeclaration, TypeAliasDeclaration, Node } from 'ts-morph';
import * as path from 'path';
import {
  ServiceMetadata,
  MethodMetadata,
  ParameterMetadata,
  DecoratorMetadata,
  TypeMetadata,
  ParseResult,
  WorkspaceProject,
} from './types';

const buildWorkspacePaths = (
  projects: WorkspaceProject[],
): Record<string, string[]> => {
  const paths: Record<string, string[]> = {};

  for (const project of projects) {
    // Map @scope/name -> src/index.ts
    paths[project.name] = [path.join(project.srcPath, 'index.ts')];
    // Map @scope/name/* -> src/*
    paths[`${project.name}/*`] = [path.join(project.srcPath, '*')];
  }

  return paths;
};

export class Parser {
  private project: Project;
  private collectedTypes = new Map<string, TypeMetadata>();

  constructor(workspaceProjects?: WorkspaceProject[]) {
    const workspacePaths = workspaceProjects
      ? buildWorkspacePaths(workspaceProjects)
      : {};

    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        // Add workspace path mappings to resolve from source
        paths: workspacePaths,
        // Use bundler resolution for better source file handling
        moduleResolution: 100, // ts.ModuleResolutionKind.Bundler
      },
    });
  }

  parse(inputDirs: string[]): ParseResult {
    // Add source files from all input directories
    for (const inputDir of inputDirs) {
      this.project.addSourceFilesAtPaths(path.join(inputDir, '**/*.ts'));
    }

    const services: ServiceMetadata[] = [];

    for (const sourceFile of this.project.getSourceFiles()) {
      for (const classDecl of sourceFile.getClasses()) {
        if (this.hasExposeDecorator(classDecl)) {
          services.push(this.parseService(classDecl, sourceFile));
        }
      }
    }

    return {
      services,
      types: Array.from(this.collectedTypes.values()),
    };
  }

  private hasExposeDecorator(classDecl: ClassDeclaration): boolean {
    return classDecl.getDecorators().some((d) => {
      const name = d.getName();
      if (name !== 'Expose') return false;

      // Check for transport: 'json-rpc' argument
      const args = d.getArguments();
      if (args.length === 0) return false;

      const argText = args[0].getText();
      return argText.includes('json-rpc');
    });
  }

  private parseService(classDecl: ClassDeclaration, sourceFile: SourceFile): ServiceMetadata {
    const className = classDecl.getName() || 'UnknownService';
    const methods: MethodMetadata[] = [];

    for (const method of classDecl.getMethods()) {
      // Skip private/protected methods
      if (method.hasModifier('private') || method.hasModifier('protected')) {
        continue;
      }

      methods.push(this.parseMethod(method));
    }

    return {
      className,
      methods,
      sourceFile: sourceFile.getFilePath(),
    };
  }

  private parseMethod(method: MethodDeclaration): MethodMetadata {
    const name = method.getName();
    const parameters: ParameterMetadata[] = [];
    const decorators: DecoratorMetadata[] = [];

    // Parse parameters
    for (const param of method.getParameters()) {
      const paramType = param.getType();
      const typeName = this.getTypeName(paramType);

      // Collect DTO type if it's a class/interface
      this.collectType(paramType);

      parameters.push({
        name: param.getName(),
        type: typeName,
        isDto: this.isDto(paramType),
      });
    }

    // Parse decorators
    for (const decorator of method.getDecorators()) {
      decorators.push({
        name: decorator.getName(),
        arguments: decorator.getArguments().map((a) => a.getText()),
      });
    }

    // Parse return type (unwrap Promise<T>)
    const returnType = method.getReturnType();
    const unwrappedReturnType = this.unwrapPromise(returnType);

    // Collect return type if it's a class/interface
    this.collectType(returnType);

    return {
      name,
      parameters,
      returnType: unwrappedReturnType,
      decorators,
    };
  }

  private getTypeName(type: Type): string {
    const typeText = type.getText();

    // Clean up fully qualified names
    return typeText
      .replace(/import\([^)]+\)\./g, '')
      .replace(/typeof /g, '');
  }

  private unwrapPromise(type: Type): string {
    const typeText = type.getText();

    // Match Promise<T> and extract T
    const promiseMatch = typeText.match(/Promise<(.+)>$/);
    if (promiseMatch) {
      return promiseMatch[1]
        .replace(/import\([^)]+\)\./g, '')
        .replace(/typeof /g, '');
    }

    return this.getTypeName(type);
  }

  private isDto(type: Type): boolean {
    // Check if type is a class or interface (not primitive)
    const symbol = type.getSymbol() || type.getAliasSymbol();
    if (!symbol) return false;

    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) return false;

    const decl = declarations[0];
    return (
      decl.getKindName() === 'ClassDeclaration' ||
      decl.getKindName() === 'InterfaceDeclaration'
    );
  }

  private collectType(type: Type): void {
    // Get the symbol first to collect the base type (e.g., AuthResponse from AuthResponse<Role>)
    const symbol = type.getSymbol() || type.getAliasSymbol();

    // Collect the base type if it exists
    if (symbol) {
      const typeName = symbol.getName();

      // Skip built-in types
      if (!['string', 'number', 'boolean', 'void', 'null', 'undefined', 'any', 'unknown', 'Promise', 'Array'].includes(typeName)) {
        if (!this.collectedTypes.has(typeName)) {
          this.collectTypeFromSymbol(symbol, typeName);
        }
      }
    }

    // Then collect type arguments (e.g., Role from AuthResponse<Role>)
    const typeArgs = type.getTypeArguments();
    if (typeArgs.length > 0) {
      for (const arg of typeArgs) {
        this.collectType(arg);
      }
    }

    // Unwrap array element type
    if (type.isArray()) {
      const elementType = type.getArrayElementType();
      if (elementType) {
        this.collectType(elementType);
      }
    }
  }

  private collectTypeFromSymbol(symbol: ReturnType<Type['getSymbol']>, typeName: string): void {
    if (!symbol) return;

    const declarations = symbol.getDeclarations();
    if (declarations.length === 0) return;

    const decl = declarations[0];
    const sourceFile = decl.getSourceFile();

    // Skip node_modules types
    if (sourceFile.getFilePath().includes('node_modules')) return;

    const kindName = decl.getKindName();
    let kind: TypeMetadata['kind'];

    switch (kindName) {
      case 'ClassDeclaration':
        kind = 'class';
        break;
      case 'InterfaceDeclaration':
        kind = 'interface';
        break;
      case 'EnumDeclaration':
        kind = 'enum';
        break;
      case 'TypeAliasDeclaration':
        kind = 'type-alias';
        break;
      default:
        return;
    }

    // Get source code (simplified - remove decorators for classes)
    let sourceCode = decl.getText();
    if (kind === 'class') {
      // Transform class to interface for clients
      sourceCode = this.classToInterface(decl.getText(), typeName);
    }

    // Add to collected types BEFORE recursing to prevent infinite loops
    this.collectedTypes.set(typeName, {
      name: typeName,
      kind,
      properties: [],
      sourceFile: sourceFile.getFilePath(),
      sourceCode,
    });

    // Recursively collect property types for interfaces and classes
    this.collectPropertyTypes(decl, kindName);
  }

  private collectPropertyTypes(decl: Node, kindName: string): void {
    if (kindName === 'InterfaceDeclaration') {
      const interfaceDecl = decl as InterfaceDeclaration;
      for (const prop of interfaceDecl.getProperties()) {
        this.collectType(prop.getType());
      }
    } else if (kindName === 'ClassDeclaration') {
      const classDecl = decl as ClassDeclaration;
      for (const prop of classDecl.getProperties()) {
        this.collectType(prop.getType());
      }
    } else if (kindName === 'TypeAliasDeclaration') {
      const typeAlias = decl as TypeAliasDeclaration;
      this.collectType(typeAlias.getType());
    }
  }

  private classToInterface(classCode: string, name: string): string {
    // Simple transformation: remove decorators and convert class to interface
    const lines = classCode.split('\n');
    const cleanedLines: string[] = [];

    for (const line of lines) {
      // Skip decorator lines
      if (line.trim().startsWith('@')) continue;

      // Convert class to export interface
      if (line.includes(`class ${name}`)) {
        cleanedLines.push(`export interface ${name} {`);
        continue;
      }

      // Keep property declarations, remove method implementations
      cleanedLines.push(line);
    }

    return cleanedLines.join('\n');
  }
}
