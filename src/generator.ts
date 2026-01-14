import { Parser } from './parser';
import { ClientGenerator, GeneratorOptions, GeneratorTarget } from './types';
import { AngularGenerator } from './generators/angular';

const generators: Map<GeneratorTarget, ClientGenerator> = new Map([
  ['angular', new AngularGenerator()],
  // Future: ['react', new ReactGenerator()],
  // Future: ['fetch', new FetchGenerator()],
]);

export class Generator {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  generate(options: GeneratorOptions): void {
    const { inputs, target, verbose } = options;

    const generator = generators.get(target);
    if (!generator) {
      const available = Array.from(generators.keys()).join(', ');
      throw new Error(`Unknown target: ${target}. Available targets: ${available}`);
    }

    console.log(`Parsing source files from: ${inputs.join(', ')}`);
    const result = this.parser.parse(inputs);

    console.log(`Found ${result.services.length} services, ${result.types.length} types\n`);

    if (verbose) {
      if (result.services.length > 0) {
        console.log('Services:');
        for (const service of result.services) {
          const methods = service.methods.map(m => m.name).join(', ');
          console.log(`  - ${service.className} (${service.methods.length} methods: ${methods})`);
        }
        console.log('');
      }

      if (result.types.length > 0) {
        console.log('Models:');
        for (const type of result.types) {
          console.log(`  - ${type.name} (${type.kind})`);
        }
        console.log('');
      }
    }

    console.log(`Generating ${target} client...`);
    generator.generate(result, options);
    console.log('Done.');
  }

  static getAvailableTargets(): GeneratorTarget[] {
    return Array.from(generators.keys());
  }
}
