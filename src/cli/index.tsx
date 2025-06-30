#!/usr/bin/env node
/**
 * Magic Release CLI Entry Point
 * Following the same pattern as Magic Commit but with TypeScript
 */

import { render } from 'ink';
import meow from 'meow';
import chalk from 'chalk';
import LogEngine from '@wgtechlabs/log-engine';

// IMPORTANT: Configure LogEngine immediately to prevent any console output
// before React takes control. This prevents logs from breaking the UI layout.
LogEngine.configure({
  suppressConsoleOutput: true,
});

import type { CLIFlags } from '../types/index.js';
import type { ProviderType } from '../core/llm/providers/ProviderInterface.js';
import { logger } from '../utils/logger.js';

import App from './App.js';

const cli = meow(
  `
	🪄  ${chalk.cyan('Magic Release')} - AI-powered changelog generator

	Usage
		$ magicr [options]

	Setup Commands
		-s, --set-key <key>       Set API key (auto-detects provider)
		-c, --config              Configure settings interactively
		-i, --init                Initialize project configuration
		--provider [name]         Switch provider or list all providers

	Generation Options
		--from <tag/commit>       Start from specific tag/commit
		--to <tag/commit>         End at specific tag/commit
		--dry-run                 Preview changes without writing files

	Other Options
		-v, --verbose             Enable verbose logging
		--debug                   Enable debug logging
		--help                    Show help
		--version                 Show version

	Examples
		$ magicr                                # Generate changelog
		$ magicr --set-key sk-your-openai-key   # Setup API key
		$ magicr --config                       # Interactive setup
		$ magicr --from v1.0.0 --to v2.0.0      # Specific range
		$ magicr --dry-run --verbose            # Preview with logs

	For advanced options, visit: https://github.com/warengonzaga/magic-release
`,
  {
    importMeta: import.meta,
    allowUnknownFlags: false,
    flags: {
      provider: {
        type: 'string',
      },
      setKey: {
        type: 'string',
        shortFlag: 's',
      },
      setKeyUnsafe: {
        type: 'string',
      },
      testKey: {
        type: 'string',
      },
      deleteKey: {
        type: 'boolean',
        shortFlag: 'd',
      },
      config: {
        type: 'boolean',
        shortFlag: 'c',
      },
      init: {
        type: 'boolean',
        shortFlag: 'i',
      },
      generateConfig: {
        type: 'boolean',
      },
      verbose: {
        type: 'boolean',
        shortFlag: 'v',
      },
      debug: {
        type: 'boolean',
      },
      dryRun: {
        type: 'boolean',
      },
      from: {
        type: 'string',
      },
      to: {
        type: 'string',
      },
      help: {
        type: 'boolean',
      },
    },
  }
);

// Handle help flag explicitly before any other processing
if (cli.flags['help']) {
  cli.showHelp();
  process.exit(0);
}

// Handle immediate CLI operations that should exit
const handleImmediateFlags = async (): Promise<boolean> => {
  const {
    setProviderApiKey,
    setProviderApiKeyUnsafe,
    deleteProviderApiKey,
    detectProviderFromKey,
    getCurrentProvider,
    setCurrentProvider,
  } = await import('../utils/config-store.js');

  // Cast cli.flags to CLIFlags for proper type handling
  const flags = cli.flags as CLIFlags;

  try {
    // Handle API key operations first (these don't require provider to be configured)
    if (flags.setKey) {
      let targetProvider: ProviderType;
      if (flags.provider) {
        targetProvider = flags.provider;
      } else {
        const detected = detectProviderFromKey(flags.setKey);
        targetProvider = (detected ?? getCurrentProvider() ?? 'openai') as ProviderType;
      }
      await setProviderApiKey(targetProvider, flags.setKey);
      process.stdout.write('API key saved\n');
      return true;
    }

    if (flags.setKeyUnsafe) {
      let targetProvider: ProviderType;
      if (flags.provider) {
        targetProvider = flags.provider;
      } else {
        const detected = detectProviderFromKey(flags.setKeyUnsafe);
        targetProvider = (detected ?? getCurrentProvider() ?? 'openai') as ProviderType;
      }
      setProviderApiKeyUnsafe(targetProvider, flags.setKeyUnsafe);
      process.stdout.write('API key saved\n');
      return true;
    }

    if (flags.deleteKey) {
      const targetProvider = (flags.provider ?? getCurrentProvider()) as ProviderType;
      if (!targetProvider) {
        throw new Error('No provider specified or configured');
      }
      deleteProviderApiKey(targetProvider);
      process.stdout.write('API key deleted\n');
      return true;
    }

    // Handle provider operations (only if no key operations were performed)
    if ('provider' in flags && flags.provider) {
      // Only handle provider switching here, not listing
      // Provider listing will be handled by the React app for better UI
      setCurrentProvider(flags.provider as ProviderType);
      process.stdout.write(`Switched to ${flags.provider} provider\n`);
      return true;
    }
  } catch (error) {
    logger.error(`Error: ${(error as Error).message}`);
    process.stderr.write(`Error: ${(error as Error).message}\n`);
    process.exit(2);
  }

  return false;
};

// Handle immediate flags and exit if needed
const shouldExit = await handleImmediateFlags();
if (shouldExit) {
  process.exit(0);
}

// Configure log levels based on CLI flags for the underlying LogEngine
// --debug = development mode (all logs)
// --verbose = staging/test mode (info, warn, error)
// no flag = production mode (warn, error only)

// Configure LogEngine based on flags while keeping console output suppressed
if (cli.flags.debug || cli.flags.verbose) {
  const { LogMode } = await import('@wgtechlabs/log-engine');
  let logMode = LogMode.WARN; // Default
  if (cli.flags.debug) {
    logMode = LogMode.DEBUG;
  } else if (cli.flags.verbose) {
    logMode = LogMode.INFO;
  }

  LogEngine.configure({
    mode: logMode,
    suppressConsoleOutput: true, // Keep console output suppressed
  });
} else {
  // For normal mode, also suppress console output to maintain clean UI
  const { LogMode } = await import('@wgtechlabs/log-engine');
  LogEngine.configure({
    mode: LogMode.WARN,
    suppressConsoleOutput: true,
  });
}

// Note: ConsoleBox will add the outputHandler when it mounts

// Render the React app with CLI flags
render(<App flags={cli.flags as CLIFlags} />);
