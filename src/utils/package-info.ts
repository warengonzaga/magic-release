/**
 * Package information utilities
 * Reads dynamic package information from package.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

interface PackageJson {
  name: string;
  version: string;
  description?: string;
}

/**
 * Get the current directory path for ES modules
 */
const getCurrentDir = (): string => {
  const __filename = fileURLToPath(import.meta.url);
  return dirname(__filename);
};

/**
 * Read and parse package.json
 */
const getPackageJson = (): PackageJson => {
  try {
    const currentDir = getCurrentDir();
    // Navigate up to the project root (from src/utils to project root)
    const packageJsonPath = join(currentDir, '..', '..', 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(packageJsonContent) as PackageJson;
  } catch (error) {
    // Fallback to default values if package.json cannot be read
    return {
      name: 'magicr',
      version: '0.1.0-beta',
      description: 'AI-powered changelog generator',
    };
  }
};

/**
 * Get the current version from package.json
 */
export const getVersion = (): string => {
  const packageJson = getPackageJson();
  return packageJson.version;
};

/**
 * Get the package name from package.json
 */
export const getPackageName = (): string => {
  const packageJson = getPackageJson();
  return packageJson.name;
};

/**
 * Get the package description from package.json
 */
export const getDescription = (): string => {
  const packageJson = getPackageJson();
  return packageJson.description ?? 'AI-powered changelog generator';
};
