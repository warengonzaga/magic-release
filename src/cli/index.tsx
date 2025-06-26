#!/usr/bin/env node
/**
 * MagicRelease CLI Entry Point
 * Following the same pattern as Magic Commit but with TypeScript
 */

import { render } from 'ink';
import meow from 'meow';
import chalk from 'chalk';

import type { CLIFlags } from '../types/index.js';
import type { ProviderType } from '../core/llm/providers/ProviderInterface.js';
import { logger } from '../utils/logger.js';

import App from './App.js';

const cli = meow(
  `
	${chalk.cyan('🪄 MagicRelease')} - AI-powered changelog generator

	Usage
		$ magicr

	Options
		--provider           Switch provider or list all providers (if no arg)
		--set-key, -s        Set API key (auto-detects provider or uses --provider)
		--set-key-unsafe     Set API key without validation
		--test-key           Test if an API key is working
		--delete-key, -d     Delete stored API key for current or specified provider
		--config, -c         Configure settings interactively
		--init, -i           Initialize project configuration
		--generate-config    Generate sample .magicrrc configuration file
		--verbose, -v        Enable verbose logging (shows info and debug)
		--debug              Enable debug logging (shows debug only)
		--dry-run            Preview changes without writing files
		--from               Start from specific tag/commit
		--to                 End at specific tag/commit
		--help               Show help
		--version            Show version

	Examples
		$ magicr
		$ magicr --set-key sk-your-openai-key            # Auto-detects OpenAI
		$ magicr --provider anthropic --set-key your-key # Set Anthropic key
		$ magicr --provider azure --set-key your-key     # Set Azure key
		$ magicr --set-key-unsafe sk-your-key            # Skip validation
		$ magicr --test-key sk-your-key                  # Test key
		$ magicr --provider                              # List all providers
		$ magicr --provider anthropic                    # Switch to Anthropic
		$ magicr --config
		$ magicr --init
		$ magicr --generate-config                       # Create .magicrrc template
		$ magicr --from v1.0.0 --to v2.0.0
		$ magicr --dry-run --verbose
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
    },
  }
);

// Enable UI mode to suppress logger output during React Ink rendering
logger.enableUIMode();

// Configure log levels based on CLI flags
// --debug = development mode (all logs)
// --verbose = staging/test mode (info, warn, error)
// no flag = production mode (warn, error only)
logger.configureLogLevels(cli.flags.debug, cli.flags.verbose);

// Handle immediate CLI operations that should exit
const handleImmediateFlags = async (): Promise<boolean> => {
  const {
    setProviderApiKey,
    setProviderApiKeyUnsafe,
    deleteProviderApiKey,
    detectProviderFromKey,
    getCurrentProvider,
  } = await import('../utils/config-store.js');

  try {
    // Handle API key operations
    if (cli.flags.setKey) {
      let targetProvider = cli.flags.provider as ProviderType;
      if (!targetProvider) {
        const detected = detectProviderFromKey(cli.flags.setKey);
        targetProvider = (detected ?? getCurrentProvider() ?? 'openai') as ProviderType;
      }
      await setProviderApiKey(targetProvider, cli.flags.setKey);
      process.stdout.write('API key saved\n');
      return true;
    }

    if (cli.flags.setKeyUnsafe) {
      let targetProvider = cli.flags.provider as ProviderType;
      if (!targetProvider) {
        const detected = detectProviderFromKey(cli.flags.setKeyUnsafe);
        targetProvider = (detected ?? getCurrentProvider() ?? 'openai') as ProviderType;
      }
      setProviderApiKeyUnsafe(targetProvider, cli.flags.setKeyUnsafe);
      process.stdout.write('API key saved\n');
      return true;
    }

    if (cli.flags.deleteKey) {
      const targetProvider = (cli.flags.provider ?? getCurrentProvider()) as ProviderType;
      if (!targetProvider) {
        throw new Error('No provider specified or configured');
      }
      deleteProviderApiKey(targetProvider);
      process.stdout.write('API key deleted\n');
      return true;
    }
  } catch (error) {
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

// Render the React app with CLI flags
render(<App flags={cli.flags as CLIFlags} />);
