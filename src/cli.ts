#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { Generator } from './generator';
import { GeneratorTarget } from './types';
import { loadWorkspaceProjects, resolveProjectNames, findWorkspaceRoot } from './workspace';

const program = new Command();

program
  .name('exposify-codegen')
  .description('Generate typed clients from NestJS @Expose decorated services')
  .version('0.0.1')
  .argument('<projects...>', 'Workspace project names to scan (e.g., api auth)')
  .option('-o, --output <path>', 'Output directory for generated code', '.')
  .option('-e, --endpoint <path>', 'JSON-RPC endpoint path', '/rpc/v1')
  .requiredOption('-t, --target <target>', 'Target framework (angular, preact)')
  .option('-r, --root <path>', 'Workspace root directory')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (projectNames: string[], options) => {
    try {
      // Find workspace root
      const root = options.root
        ? path.resolve(options.root)
        : findWorkspaceRoot(process.cwd());

      if (!root) {
        console.error('Error: Could not find workspace root (no package.json with workspaces field)');
        console.error('Run from within a workspace or specify --root');
        process.exit(1);
      }

      // Load workspace projects
      const projects = await loadWorkspaceProjects(root);

      // Resolve project names to actual projects
      const resolved = resolveProjectNames(projectNames, projects);

      if (resolved.length === 0) {
        console.error(`Error: Could not resolve any projects from: ${projectNames.join(', ')}`);
        console.error(`Available projects: ${Array.from(projects.keys()).join(', ')}`);
        process.exit(1);
      }

      const inputs = resolved.map((p) => p.srcPath);
      const output = path.resolve(process.cwd(), options.output);
      const target = options.target as GeneratorTarget;

      const availableTargets = Generator.getAvailableTargets();
      if (!availableTargets.includes(target)) {
        console.error(`Error: Unknown target '${target}'`);
        console.error(`Available targets: ${availableTargets.join(', ')}`);
        process.exit(1);
      }

      console.log('exposify-codegen');
      console.log('================');
      console.log(`Workspace: ${root}`);
      console.log(`Projects:  ${resolved.map((p) => p.name).join(', ')}`);
      console.log(`Output:    ${output}`);
      console.log(`Endpoint:  ${options.endpoint}`);
      console.log(`Target:    ${target}`);
      console.log('');

      const generator = new Generator();
      generator.generate({
        inputs,
        output,
        endpoint: options.endpoint,
        target,
        verbose: options.verbose,
      });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
