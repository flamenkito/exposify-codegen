import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface Project {
  name: string;
  path: string;
  srcPath: string;
  packageJson: Record<string, unknown>;
}

export async function loadWorkspaceProjects(root: string): Promise<Map<string, Project>> {
  const rootPkgPath = path.join(root, 'package.json');

  if (!fs.existsSync(rootPkgPath)) {
    throw new Error(`No package.json found at ${root}`);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  const workspaces: string[] = rootPkg.workspaces || [];

  if (workspaces.length === 0) {
    throw new Error('No workspaces defined in package.json');
  }

  const projects = new Map<string, Project>();

  for (const pattern of workspaces) {
    const matches = await glob(pattern, { cwd: root });

    for (const match of matches) {
      const projectPath = path.join(root, match);
      const pkgPath = path.join(projectPath, 'package.json');

      if (!fs.existsSync(pkgPath)) continue;

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.name) continue;

      // Determine src path
      const srcPath = fs.existsSync(path.join(projectPath, 'src'))
        ? path.join(projectPath, 'src')
        : projectPath;

      projects.set(pkg.name, {
        name: pkg.name,
        path: match,
        srcPath,
        packageJson: pkg,
      });
    }
  }

  return projects;
}

export function resolveProjectNames(
  names: string[],
  projects: Map<string, Project>
): Project[] {
  const resolved: Project[] = [];

  for (const name of names) {
    // Try exact match first
    let project = projects.get(name);

    if (!project) {
      // Try matching by short name (e.g., "api" matches "@example/api")
      for (const [fullName, p] of projects) {
        const shortName = fullName.includes('/')
          ? fullName.split('/').pop()
          : fullName;

        if (shortName === name) {
          project = p;
          break;
        }
      }
    }

    if (!project) {
      // Try matching by path
      for (const [, p] of projects) {
        if (p.path === name || p.path.endsWith(`/${name}`)) {
          project = p;
          break;
        }
      }
    }

    if (project) {
      resolved.push(project);
    } else {
      console.warn(`Warning: Could not resolve project '${name}'`);
    }
  }

  return resolved;
}

export function findWorkspaceRoot(startDir: string): string | null {
  let dir = startDir;

  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return dir;
      }
    }

    dir = path.dirname(dir);
  }

  return null;
}
