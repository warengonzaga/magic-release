/**
 * Main Aimport { 
  hasValidConfig, 
  setProviderApiKey, 
  setProviderApiKeyUnsafe,
  testAPIKey,
  deleteProviderApiKey, 
  getCurrentProvider,
  setCurrentProvider,
  listAllProviders
} from '../utils/config-store.js';nent for MagicRelease CLI
 * React component using Ink for terminal UI
 */

import { Text, Newline, Box } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import React, { useEffect, useState } from 'react';

import type { CLIFlags } from '../types/index.js';
import type { ProviderType } from '../core/llm/providers/ProviderInterface.js';
import { ASCII_ART, URLS } from '../constants/index.js';
import { getVersion } from '../utils/package-info.js';
import {
  hasValidConfig,
  setProviderApiKey,
  setProviderApiKeyUnsafe,
  testAPIKey,
  deleteProviderApiKey,
  getCurrentProvider,
  setCurrentProvider,
  listAllProviders,
  detectProviderFromKey,
} from '../utils/config-store.js';
import { isGitRepository, isCommitterConfigured } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface AppProps {
  flags: CLIFlags;
}

const App: React.FC<AppProps> = ({ flags }) => {
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    // Handle side effects that might exit the process
    const handleFlags = async (): Promise<void> => {
      try {
        // Handle configuration and initialization commands
        if (flags.config || flags.init || flags.generateConfig) {
          return; // These are handled by components
        }

        // Handle provider switching or listing
        if (flags.provider !== undefined) {
          if (flags.provider) {
            // Switch to specific provider
            await handleProviderSwitchEffect(flags.provider);
            return;
          }
          // Show provider list when --provider is used without argument
          return;
        }

        // Handle API key operations
        if (flags.setKey) {
          await handleSetKeyEffect(flags.setKey, flags.provider);
          return;
        }

        if (flags.setKeyUnsafe) {
          await handleSetKeyUnsafeEffect(flags.setKeyUnsafe, flags.provider);
          return;
        }

        if (flags.deleteKey) {
          await handleDeleteKeyEffect(flags.provider);
          return;
        }
      } catch (error) {
        setActionResult(`Error: ${(error as Error).message}`);
      }
    };

    void handleFlags();
  }, [flags]);

  // Show simple result message if there was an action
  if (actionResult) {
    return (
      <Box flexDirection="column">
        <Text color="red">{actionResult}</Text>
      </Box>
    );
  }

  // Handle configuration and initialization commands
  if (flags.config) {
    return <ConfigurationInterface />;
  }

  if (flags.init) {
    return <InitializationInterface />;
  }

  if (flags.generateConfig) {
    return <GenerateConfigInterface />;
  }

  // Handle provider listing
  if (flags.provider !== undefined && !flags.provider) {
    return <ListProvidersInterface />;
  }

  // Handle test key
  if (flags.testKey) {
    return <TestApiKeyInterface apiKey={flags.testKey} />;
  }

  // Check if user has valid configuration
  if (!hasValidConfig()) {
    return <NoConfigurationMessage />;
  }

  // Check git repository and configuration
  const gitRepoCheck = isGitRepository();
  const committerCheck = isCommitterConfigured();

  if (!gitRepoCheck || !committerCheck) {
    return <GitErrorMessage gitRepo={gitRepoCheck} committer={committerCheck} />;
  }

  // If all checks pass, show the main interface
  return <MainInterface flags={flags} />;
};

const AppHeader: React.FC = () => (
  <Box flexDirection='column' marginBottom={1}>
    <Gradient name='passion'>
      <BigText text='Magic Release' />
    </Gradient>
    <Text>
      {ASCII_ART.LOGO} You can do magic with releases! {ASCII_ART.MAGIC}
    </Text>
    <Text>
      Version: <Text color='green'>{getVersion()}</Text> | Author:{' '}
      <Text color='blue'>Waren Gonzaga</Text>
    </Text>
    <Newline />
    <Text>
      Need Help? <Text color='cyan'>magicr --help</Text>
    </Text>
    <Text>{'='.repeat(50)}</Text>
  </Box>
);

const NoConfigurationMessage: React.FC = () => (
  <Box flexDirection='column'>
    <AppHeader />
    <Text color='yellow'>{ASCII_ART.WARNING} No API key configured</Text>
    <Newline />
    <Text>Please provide an OpenAI API key to get started.</Text>
    <Text>
      You can get one from: <Text color='cyan'>{URLS.OPENAI_KEYS}</Text>
    </Text>
    <Newline />
    <Text>
      Run <Text color='green'>magicr --set-api-key=&lt;your-key&gt;</Text> to save your API key.
    </Text>
    <Text>
      Or run <Text color='green'>magicr --config</Text> for interactive setup.
    </Text>
  </Box>
);

interface GitErrorMessageProps {
  gitRepo: boolean;
  committer: boolean;
}

const GitErrorMessage: React.FC<GitErrorMessageProps> = ({ gitRepo, committer }) => (
  <Box flexDirection='column'>
    <AppHeader />
    {!gitRepo && (
      <>
        <Text color='red'>{ASCII_ART.ERROR} This is not a Git repository</Text>
        <Text>Please run this command in a Git repository or initialize one with:</Text>
        <Text color='green'>git init</Text>
        <Newline />
      </>
    )}
    {!committer && (
      <>
        <Text color='red'>{ASCII_ART.ERROR} Git committer not configured</Text>
        <Text>Please configure your Git identity:</Text>
        <Text color='green'>git config --global user.name "Your Name"</Text>
        <Text color='green'>git config --global user.email "your.email@example.com"</Text>
      </>
    )}
  </Box>
);

interface MainInterfaceProps {
  flags: CLIFlags;
}

const MainInterface: React.FC<MainInterfaceProps> = ({ flags }) => {
  const [result, setResult] = React.useState<{
    status: 'loading' | 'success' | 'error';
    content?: string;
    error?: string;
  }>({ status: 'loading' });

  const provider = getCurrentProvider();

  React.useEffect(() => {
    const runChangelog = async () => {
      try {
        // Keep UI mode enabled during the async operation to prevent logger interference
        logger.enableUIMode();

        // Import MagicRelease dynamically
        const { default: MagicRelease } = await import('../core/MagicRelease.js');
        const { getConfig } = await import('../utils/config-store.js');

        const config = getConfig();
        const magicRelease = new MagicRelease(config);

        const generateOptions = {
          ...(flags.dryRun && { dryRun: flags.dryRun }),
          ...(flags.verbose && { verbose: flags.verbose }),
          ...(flags.from && { from: flags.from }),
          ...(flags.to && { to: flags.to }),
        };

        const changelog = await magicRelease.generate(generateOptions);

        setResult({
          status: 'success',
          content: changelog,
        });
      } catch (err: any) {
        setResult({
          status: 'error',
          error: err.message || 'Unknown error occurred',
        });
      } finally {
        // Ensure UI mode remains enabled to prevent further output
        logger.enableUIMode();
      }
    };

    runChangelog();
  }, [flags.dryRun, flags.verbose, flags.from, flags.to]);

  return (
    <Box flexDirection='column'>
      {/* Static Header - Always at the top */}
      <Box flexDirection='column' marginBottom={1}>
        <Gradient name='passion'>
          <BigText text='Magic Release' />
        </Gradient>
        <Text>
          {ASCII_ART.LOGO} You can do magic with releases! {ASCII_ART.MAGIC}
        </Text>
        <Text>
          Version: <Text color='green'>{getVersion()}</Text> | Author:{' '}
          <Text color='blue'>Waren Gonzaga</Text> | Provider: <Text color='cyan'>{provider}</Text>
        </Text>
        <Text>{'='.repeat(60)}</Text>
      </Box>

      {/* Status Section */}
      <Box flexDirection='column' marginBottom={1}>
        {flags.verbose && <Text color='gray'>• Verbose mode enabled</Text>}

        {flags.dryRun && <Text color='yellow'>• Dry run mode - no files will be modified</Text>}

        {result.status === 'loading' && (
          <Text color='blue'>{ASCII_ART.LOADING} Generating changelog...</Text>
        )}

        {result.status === 'success' && (
          <Text color='green'>{ASCII_ART.SUCCESS} Changelog generated successfully!</Text>
        )}

        {result.status === 'error' && (
          <Text color='red'>
            {ASCII_ART.ERROR} Error: {result.error}
          </Text>
        )}
      </Box>

      {/* Success Preview Section */}
      {result.status === 'success' && flags.dryRun && result.content && (
        <Box flexDirection='column' marginTop={1}>
          <Text color='yellow'>Generated changelog preview:</Text>
          <Text color='gray'>{'='.repeat(50)}</Text>
          <Text>{result.content.substring(0, 300)}...</Text>
          <Text color='gray'>{'='.repeat(50)}</Text>
        </Box>
      )}
    </Box>
  );
};

const ConfigurationInterface: React.FC = () => {
  return (
    <Box flexDirection='column'>
      <AppHeader />
      <Text color='cyan'>{ASCII_ART.MAGIC} Interactive Configuration</Text>
      <Newline />

      <Text>For configuration, please use one of these commands:</Text>
      <Newline />
      <Text color='green'>magicr --set-api-key=&lt;your-openai-key&gt;</Text>
      <Text color='gray'>Set your OpenAI API key</Text>
      <Newline />
      <Text color='green'>magicr --delete-api-key</Text>
      <Text color='gray'>Remove stored API key</Text>
      <Newline />
      <Text>
        You can get an API key from: <Text color='cyan'>{URLS.OPENAI_KEYS}</Text>
      </Text>
    </Box>
  );
};

const InitializationInterface: React.FC = () => {
  const [result, setResult] = React.useState<{
    status: 'checking' | 'ready' | 'error';
    checks?: {
      gitRepo: boolean;
      gitConfig: boolean;
      packageJson: boolean;
      changelog: boolean;
    };
  }>({ status: 'checking' });

  React.useEffect(() => {
    const runChecks = async () => {
      try {
        // Ensure UI mode is enabled during async operations
        logger.enableUIMode();

        const gitRepo = isGitRepository();
        const gitConfig = isCommitterConfigured();

        // Check for package.json
        let packageJson = false;
        try {
          await import('../../package.json', { with: { type: 'json' } });
          packageJson = true;
        } catch {
          packageJson = false;
        }

        // Check for existing CHANGELOG.md
        let changelog = false;
        try {
          await import('fs').then(fs => fs.promises.access('./CHANGELOG.md'));
          changelog = true;
        } catch {
          changelog = false;
        }

        // Single state update to prevent multiple re-renders
        setResult({
          status: 'ready',
          checks: { gitRepo, gitConfig, packageJson, changelog },
        });
      } catch (err) {
        setResult({ status: 'error' });
      } finally {
        // Ensure UI mode remains enabled
        logger.enableUIMode();
      }
    };

    runChecks();
  }, []);

  return (
    <Box flexDirection='column'>
      <AppHeader />
      <Text color='cyan'>{ASCII_ART.MAGIC} Project Initialization</Text>
      <Newline />

      {result.status === 'checking' && <Text>{ASCII_ART.LOADING} Checking project setup...</Text>}

      {result.status === 'ready' && result.checks && (
        <>
          <Text>Project Check Results:</Text>
          <Newline />

          <Text color={result.checks.gitRepo ? 'green' : 'red'}>
            {result.checks.gitRepo ? '✅' : '❌'} Git repository
          </Text>

          <Text color={result.checks.gitConfig ? 'green' : 'red'}>
            {result.checks.gitConfig ? '✅' : '❌'} Git user configuration
          </Text>

          <Text color={result.checks.packageJson ? 'green' : 'yellow'}>
            {result.checks.packageJson ? '✅' : '⚠️'} package.json file
          </Text>

          <Text color={result.checks.changelog ? 'yellow' : 'green'}>
            {result.checks.changelog ? '⚠️' : '✅'} CHANGELOG.md{' '}
            {result.checks.changelog ? '(exists - will be updated)' : '(will be created)'}
          </Text>

          <Newline />

          {result.checks.gitRepo && result.checks.gitConfig ? (
            <Text color='green'>{ASCII_ART.SUCCESS} Project is ready for Magic Release!</Text>
          ) : (
            <Text color='yellow'>
              {ASCII_ART.WARNING} Please fix the issues above before using Magic Release
            </Text>
          )}
        </>
      )}

      {result.status === 'error' && (
        <Text color='red'>{ASCII_ART.ERROR} Error checking project setup</Text>
      )}
    </Box>
  );
};

interface TestApiKeyInterfaceProps {
  apiKey: string;
}

const TestApiKeyInterface: React.FC<TestApiKeyInterfaceProps> = ({ apiKey }) => {
  const [status, setStatus] = React.useState<'testing' | 'success' | 'error'>('testing');
  const [result, setResult] = React.useState<{
    valid: boolean;
    message: string;
    details?: any;
  } | null>(null);

  React.useEffect(() => {
    const runTest = async () => {
      setStatus('testing');
      try {
        const testResult = await testAPIKey(apiKey);
        setResult(testResult);
        setStatus(testResult.valid ? 'success' : 'error');
      } catch (error: any) {
        setResult({
          valid: false,
          message: `Test failed: ${error.message}`,
          details: { error: error.message },
        });
        setStatus('error');
      }
    };

    runTest();
  }, [apiKey]);

  React.useEffect(() => {
    if (status !== 'testing') {
      const timer = setTimeout(() => process.exit(status === 'success' ? 0 : 1), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  return (
    <Box flexDirection='column'>
      <AppHeader />
      <Text color='cyan'>{ASCII_ART.MAGIC} API Key Test</Text>
      <Newline />

      {status === 'testing' && <Text>{ASCII_ART.LOADING} Testing API key connectivity...</Text>}

      {status === 'success' && result && (
        <>
          <Text color='green'>{result.message}</Text>
          {result.details && (
            <>
              <Newline />
              <Text color='gray'>
                Details: Status {result.details.status}, {result.details.modelCount} models
                available
              </Text>
              <Text color='gray'>Tested at: {result.details.timestamp}</Text>
            </>
          )}
        </>
      )}

      {status === 'error' && result && (
        <>
          <Text color='red'>{result.message}</Text>
          {result.details && (
            <>
              <Newline />
              <Text color='gray'>Details: {JSON.stringify(result.details, null, 2)}</Text>
            </>
          )}
        </>
      )}
    </Box>
  );
};

const GenerateConfigInterface: React.FC = () => {
  const [status, setStatus] = React.useState<'generating' | 'success' | 'error' | 'exists'>(
    'generating'
  );
  const [configPath, setConfigPath] = React.useState<string>('');

  React.useEffect(() => {
    const generateConfig = async () => {
      try {
        // Ensure UI mode is enabled during async operations
        logger.enableUIMode();

        const { writeFileSync, existsSync } = await import('fs');
        const { join } = await import('path');
        const { generateSampleConfig, CONFIG_FILENAMES } = await import(
          '../utils/project-config.js'
        );

        // Check if any config file already exists
        const cwd = process.cwd();
        const existingConfig = CONFIG_FILENAMES.find(filename => existsSync(join(cwd, filename)));

        if (existingConfig) {
          setConfigPath(join(cwd, existingConfig));
          setStatus('exists');
          return;
        }

        // Generate new config file
        const sampleConfig = generateSampleConfig();
        const newConfigPath = join(cwd, '.magicrrc');

        writeFileSync(newConfigPath, sampleConfig, 'utf-8');

        setConfigPath(newConfigPath);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
      } finally {
        // Ensure UI mode remains enabled
        logger.enableUIMode();
      }
    };

    generateConfig();
  }, []);

  React.useEffect(() => {
    if (status !== 'generating') {
      const timer = setTimeout(() => process.exit(status === 'success' ? 0 : 1), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  return (
    <Box flexDirection='column'>
      <AppHeader />
      <Text color='cyan'>{ASCII_ART.MAGIC} Generate Project Configuration</Text>
      <Newline />

      {status === 'generating' && (
        <Text>{ASCII_ART.LOADING} Generating .magicrrc configuration file...</Text>
      )}

      {status === 'success' && (
        <>
          <Text color='green'>{ASCII_ART.SUCCESS} Configuration file generated successfully!</Text>
          <Newline />
          <Text>
            Created: <Text color='cyan'>{configPath}</Text>
          </Text>
          <Newline />
          <Text>You can now customize your Magic Release settings by editing this file.</Text>
          <Text color='gray'>
            The file contains examples for all available configuration options.
          </Text>
        </>
      )}

      {status === 'exists' && (
        <>
          <Text color='yellow'>{ASCII_ART.WARNING} Configuration file already exists!</Text>
          <Newline />
          <Text>
            Found: <Text color='cyan'>{configPath}</Text>
          </Text>
          <Newline />
          <Text>To regenerate, please delete the existing file first.</Text>
        </>
      )}

      {status === 'error' && (
        <>
          <Text color='red'>{ASCII_ART.ERROR} Failed to generate configuration file</Text>
          <Newline />
          <Text>Please check your file permissions and try again.</Text>
        </>
      )}
    </Box>
  );
};

// Helper functions
// Effect handlers that don't call process.exit (for use in React components)
const handleProviderSwitchEffect = async (provider: ProviderType): Promise<void> => {
  setCurrentProvider(provider);
  console.log(`✅ Switched to ${provider} provider`);
  setTimeout(() => process.exit(0), 100); // Delay exit to let React finish
};

const handleSetKeyEffect = async (
  apiKey: string,
  provider?: ProviderType
): Promise<void> => {
  let targetProvider = provider;
  
  // If no provider specified, try to auto-detect from key format
  if (!targetProvider) {
    const detected = detectProviderFromKey(apiKey);
    if (detected) {
      targetProvider = detected;
      console.log(`🔍 Auto-detected ${detected} provider from key format`);
    } else {
      // Default to current provider or OpenAI
      targetProvider = (getCurrentProvider() as ProviderType) ?? 'openai';
      console.log(`⚠️ Could not auto-detect provider, using ${targetProvider}`);
    }
  }
  
  await setProviderApiKey(targetProvider, apiKey);
  setTimeout(() => process.exit(0), 100); // Delay exit to let React finish
};

const handleSetKeyUnsafeEffect = async (
  apiKey: string,
  provider?: ProviderType
): Promise<void> => {
  let targetProvider = provider;
  
  // If no provider specified, try to auto-detect from key format
  if (!targetProvider) {
    const detected = detectProviderFromKey(apiKey);
    if (detected) {
      targetProvider = detected;
      console.log(`🔍 Auto-detected ${detected} provider from key format`);
    } else {
      // Default to current provider or OpenAI
      targetProvider = (getCurrentProvider() as ProviderType) ?? 'openai';
      console.log(`⚠️ Could not auto-detect provider, using ${targetProvider}`);
    }
  }
  
  setProviderApiKeyUnsafe(targetProvider, apiKey);
  setTimeout(() => process.exit(0), 100); // Delay exit to let React finish
};

const handleDeleteKeyEffect = async (provider?: ProviderType): Promise<void> => {
  const targetProvider = provider ?? (getCurrentProvider() as ProviderType);
  if (!targetProvider) {
    throw new Error('❌ No provider specified or configured');
  }
  deleteProviderApiKey(targetProvider);
  setTimeout(() => process.exit(0), 100); // Delay exit to let React finish
};

// List providers interface
const ListProvidersInterface: React.FC = () => {
  const providers = listAllProviders();
  
  return (
    <Box flexDirection="column">
      <AppHeader />
      <Text color="cyan">📋 Configured API Providers</Text>
      <Newline />
      
      {providers.map(({ provider, hasKey, isCurrent }) => (
        <Box key={provider} marginBottom={1}>
          <Text color={isCurrent ? 'green' : 'gray'}>
            {isCurrent ? '→ ' : '  '}
            {provider.toUpperCase()}: {hasKey ? '✅ Key configured' : '❌ No key'}
            {isCurrent ? ' (current)' : ''}
          </Text>
        </Box>
      ))}
      
      <Newline />
      <Text color="yellow">
        Use --provider &lt;name&gt; --set-key &lt;key&gt; to configure a provider
      </Text>
      <Text color="yellow">
        Use --provider &lt;name&gt; to switch providers
      </Text>
    </Box>
  );
};

export default App;
