#!/usr/bin/env node
/**
 * MagicRelease CLI Entry Point
 * Following the same pattern as Magic Commit but with TypeScript
 */

import { render } from 'ink';
import meow from 'meow';
import chalk from 'chalk';

import type { CLIFlags } from '../types/index.js';
import App from './App.js';

const cli = meow(`
	${chalk.cyan('🪄 MagicRelease')} - AI-powered changelog generator

	Usage
		$ magicr

	Options
		--set-api-key, -s    Set OpenAI API key
		--set-api-key-unsafe Set OpenAI API key without validation
		--test-api-key       Test if an API key is working
		--delete-api-key, -d Delete stored API key
		--config, -c         Configure settings interactively
		--init, -i           Initialize project configuration
		--verbose, -v        Enable verbose logging
		--dry-run            Preview changes without writing files
		--from               Start from specific tag/commit
		--to                 End at specific tag/commit
		--help               Show help
		--version            Show version

	Examples
		$ magicr
		$ magicr --set-api-key sk-your-openai-key
		$ magicr --set-api-key-unsafe sk-your-openai-key  # Skip validation
		$ magicr --test-api-key sk-your-openai-key        # Test key
		$ magicr --config
		$ magicr --init
		$ magicr --from v1.0.0 --to v2.0.0
		$ magicr --dry-run
`, {
	importMeta: import.meta,
	flags: {
		setApiKey: {
			type: 'string',
			shortFlag: 's',
		},
		setApiKeyUnsafe: {
			type: 'string',
		},
		testApiKey: {
			type: 'string',
		},
		deleteApiKey: {
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
		verbose: {
			type: 'boolean',
			shortFlag: 'v',
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
});

// Render the React app with CLI flags
render(<App flags={cli.flags as CLIFlags} />);
