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
    const { inputs, target } = options;

    const generator = generators.get(target);
    if (!generator) {
      const available = Array.from(generators.keys()).join(', ');
      throw new Error(`Unknown target: ${target}. Available targets: ${available}`);
    }

    console.log(`Parsing source files from: ${inputs.join(', ')}`);
    const result = this.parser.parse(inputs);

    console.log(`Found ${result.services.length} services, ${result.types.length} types`);
    console.log(`Generating ${target} client...\n`);

    generator.generate(result, options);
  }

  static getAvailableTargets(): GeneratorTarget[] {
    return Array.from(generators.keys());
  }
}
