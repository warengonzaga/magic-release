/**
 * Main App Component for MagicRelease CLI
 * React component using Ink for terminal UI
 */

import { Text, Newline, Box } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import React from 'react';

import { CLIFlags } from '../types/index.js';
import { ASCII_ART, APP_VERSION, URLS } from '../constants/index.js';
import { 
  hasValidConfig, 
  setOpenAIKey, 
  setOpenAIKeyUnsafe,
  testAPIKey,
  deleteOpenAIKey, 
  getCurrentProvider 
} from '../utils/config-store.js';
import { 
  isGitRepository, 
  isCommitterConfigured,
  createNotGitRepositoryError,
  createCommitterNotConfiguredError 
} from '../utils/errors.js';

interface AppProps {
  flags: CLIFlags;
}

const App: React.FC<AppProps> = ({ flags }) => {
  // Handle configuration and initialization commands
  if (flags.config) {
    return <ConfigurationInterface />;
  }

  if (flags.init) {
    return <InitializationInterface />;
  }

  // Handle API key operations
  if (flags.setApiKey) {
    handleSetApiKey(flags.setApiKey);
    return null;
  }

  if (flags.setApiKeyUnsafe) {
    handleSetApiKeyUnsafe(flags.setApiKeyUnsafe);
    return null;
  }

  if (flags.testApiKey) {
    return <TestApiKeyInterface apiKey={flags.testApiKey} />;
  }

  if (flags.deleteApiKey) {
    handleDeleteApiKey();
    return null;
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
  return (
    <Box flexDirection="column">
      <AppHeader />
      <MainInterface flags={flags} />
    </Box>
  );
};

const AppHeader: React.FC = () => (
  <Box flexDirection="column" marginBottom={1}>
    <Gradient name="passion">
      <BigText text="MagicR" />
    </Gradient>
    <Text>
      {ASCII_ART.LOGO} You can do magic with releases! {ASCII_ART.MAGIC}
    </Text>
    <Text>
      Version: <Text color="green">{APP_VERSION}</Text> | 
      Author: <Text color="blue">Waren Gonzaga</Text>
    </Text>
    <Newline />
    <Text>
      Need Help? <Text color="cyan">magicr --help</Text>
    </Text>
    <Text>{'='.repeat(50)}</Text>
  </Box>
);

const NoConfigurationMessage: React.FC = () => (
  <Box flexDirection="column">
    <AppHeader />
    <Text color="yellow">
      {ASCII_ART.WARNING} No API key configured
    </Text>
    <Newline />
    <Text>
      Please provide an OpenAI API key to get started.
    </Text>
    <Text>
      You can get one from: <Text color="cyan">{URLS.OPENAI_KEYS}</Text>
    </Text>
    <Newline />
    <Text>
      Run <Text color="green">magicr --set-api-key=&lt;your-key&gt;</Text> to save your API key.
    </Text>
    <Text>
      Or run <Text color="green">magicr --config</Text> for interactive setup.
    </Text>
  </Box>
);

interface GitErrorMessageProps {
  gitRepo: boolean;
  committer: boolean;
}

const GitErrorMessage: React.FC<GitErrorMessageProps> = ({ gitRepo, committer }) => (
  <Box flexDirection="column">
    <AppHeader />
    {!gitRepo && (
      <>
        <Text color="red">
          {ASCII_ART.ERROR} This is not a Git repository
        </Text>
        <Text>
          Please run this command in a Git repository or initialize one with:
        </Text>
        <Text color="green">git init</Text>
        <Newline />
      </>
    )}
    {!committer && (
      <>
        <Text color="red">
          {ASCII_ART.ERROR} Git committer not configured
        </Text>
        <Text>
          Please configure your Git identity:
        </Text>
        <Text color="green">git config --global user.name "Your Name"</Text>
        <Text color="green">git config --global user.email "your.email@example.com"</Text>
      </>
    )}
  </Box>
);

interface MainInterfaceProps {
  flags: CLIFlags;
}

const MainInterface: React.FC<MainInterfaceProps> = ({ flags }) => {
  const [status, setStatus] = React.useState<'analyzing' | 'generating' | 'complete' | 'error'>('analyzing');
  const [result, setResult] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');
  
  const provider = getCurrentProvider();
  
  React.useEffect(() => {
    const generateChangelog = async () => {
      try {
        setStatus('analyzing');
        
        // Import MagicRelease dynamically to avoid circular dependencies
        const { default: MagicRelease } = await import('../core/MagicRelease.js');
        const { getConfig } = await import('../utils/config-store.js');
        
        const config = getConfig();
        const magicRelease = new MagicRelease(config);
        
        setStatus('generating');
        
        const generateOptions = {
          ...(flags.dryRun && { dryRun: flags.dryRun }),
          ...(flags.verbose && { verbose: flags.verbose }),
          ...(flags.from && { from: flags.from }),
          ...(flags.to && { to: flags.to })
        };
        
        const changelog = await magicRelease.generate(generateOptions);
        
        setResult(changelog);
        setStatus('complete');
        
      } catch (err: any) {
        setError(err.message || 'Unknown error occurred');
        setStatus('error');
      }
    };
    
    generateChangelog();
  }, [flags]);
  
  return (
    <Box flexDirection="column">
      <Text color="green">
        {ASCII_ART.SUCCESS} Ready to generate changelog!
      </Text>
      <Text>
        Provider: <Text color="cyan">{provider}</Text>
      </Text>
      <Newline />
      
      {flags.verbose && (
        <Text color="gray">Verbose mode enabled</Text>
      )}
      
      {flags.dryRun && (
        <Text color="yellow">Dry run mode - no files will be modified</Text>
      )}
      
      {status === 'analyzing' && (
        <Text>
          {ASCII_ART.LOADING} Analyzing repository...
        </Text>
      )}
      
      {status === 'generating' && (
        <Text>
          {ASCII_ART.MAGIC} Generating changelog with AI...
        </Text>
      )}
      
      {status === 'complete' && (
        <>
          <Text color="green">
            {ASCII_ART.SUCCESS} Changelog generated successfully!
          </Text>
          {flags.dryRun && (
            <>
              <Newline />
              <Text color="yellow">Generated changelog preview:</Text>
              <Text color="gray">{'='.repeat(50)}</Text>
              <Text>{result.substring(0, 500)}...</Text>
              <Text color="gray">{'='.repeat(50)}</Text>
            </>
          )}
        </>
      )}
      
      {status === 'error' && (
        <>
          <Text color="red">
            {ASCII_ART.ERROR} Error: {error}
          </Text>
        </>
      )}
    </Box>
  );
};

const ConfigurationInterface: React.FC = () => {
  return (
    <Box flexDirection="column">
      <AppHeader />
      <Text color="cyan">
        {ASCII_ART.MAGIC} Interactive Configuration
      </Text>
      <Newline />
      
      <Text>
        For configuration, please use one of these commands:
      </Text>
      <Newline />
      <Text color="green">
        magicr --set-api-key=&lt;your-openai-key&gt;
      </Text>
      <Text color="gray">
        Set your OpenAI API key
      </Text>
      <Newline />
      <Text color="green">
        magicr --delete-api-key
      </Text>
      <Text color="gray">
        Remove stored API key
      </Text>
      <Newline />
      <Text>
        You can get an API key from: <Text color="cyan">{URLS.OPENAI_KEYS}</Text>
      </Text>
    </Box>
  );
};

const InitializationInterface: React.FC = () => {
  const [status, setStatus] = React.useState<'checking' | 'ready' | 'complete' | 'error'>('checking');
  const [checks, setChecks] = React.useState({
    gitRepo: false,
    gitConfig: false,
    packageJson: false,
    changelog: false
  });

  React.useEffect(() => {
    const runChecks = async () => {
      setStatus('checking');
      
      try {
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

        setChecks({ gitRepo, gitConfig, packageJson, changelog });
        setStatus('ready');
      } catch (err) {
        setStatus('error');
      }
    };

    runChecks();
  }, []);

  return (
    <Box flexDirection="column">
      <AppHeader />
      <Text color="cyan">
        {ASCII_ART.MAGIC} Project Initialization
      </Text>
      <Newline />

      {status === 'checking' && (
        <Text>
          {ASCII_ART.LOADING} Checking project setup...
        </Text>
      )}

      {status === 'ready' && (
        <>
          <Text>Project Check Results:</Text>
          <Newline />
          
          <Text color={checks.gitRepo ? 'green' : 'red'}>
            {checks.gitRepo ? '✅' : '❌'} Git repository
          </Text>
          
          <Text color={checks.gitConfig ? 'green' : 'red'}>
            {checks.gitConfig ? '✅' : '❌'} Git user configuration
          </Text>
          
          <Text color={checks.packageJson ? 'green' : 'yellow'}>
            {checks.packageJson ? '✅' : '⚠️'} package.json file
          </Text>
          
          <Text color={checks.changelog ? 'yellow' : 'green'}>
            {checks.changelog ? '⚠️' : '✅'} CHANGELOG.md {checks.changelog ? '(exists - will be updated)' : '(will be created)'}
          </Text>
          
          <Newline />
          
          {checks.gitRepo && checks.gitConfig ? (
            <Text color="green">
              {ASCII_ART.SUCCESS} Project is ready for Magic Release!
            </Text>
          ) : (
            <Text color="yellow">
              {ASCII_ART.WARNING} Please fix the issues above before using Magic Release
            </Text>
          )}
        </>
      )}

      {status === 'error' && (
        <Text color="red">
          {ASCII_ART.ERROR} Error checking project setup
        </Text>
      )}
    </Box>
  );
};

interface TestApiKeyInterfaceProps {
  apiKey: string;
}

const TestApiKeyInterface: React.FC<TestApiKeyInterfaceProps> = ({ apiKey }) => {
  const [status, setStatus] = React.useState<'testing' | 'success' | 'error'>('testing');
  const [result, setResult] = React.useState<{ valid: boolean; message: string; details?: any } | null>(null);

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
          details: { error: error.message }
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
    <Box flexDirection="column">
      <AppHeader />
      <Text color="cyan">
        {ASCII_ART.MAGIC} API Key Test
      </Text>
      <Newline />

      {status === 'testing' && (
        <Text>
          {ASCII_ART.LOADING} Testing API key connectivity...
        </Text>
      )}

      {status === 'success' && result && (
        <>
          <Text color="green">
            {result.message}
          </Text>
          {result.details && (
            <>
              <Newline />
              <Text color="gray">
                Details: Status {result.details.status}, {result.details.modelCount} models available
              </Text>
              <Text color="gray">
                Tested at: {result.details.timestamp}
              </Text>
            </>
          )}
        </>
      )}

      {status === 'error' && result && (
        <>
          <Text color="red">
            {result.message}
          </Text>
          {result.details && (
            <>
              <Newline />
              <Text color="gray">
                Details: {JSON.stringify(result.details, null, 2)}
              </Text>
            </>
          )}
        </>
      )}
    </Box>
  );
};

// Helper functions
const handleSetApiKey = async (apiKey: string): Promise<void> => {
  try {
    await setOpenAIKey(apiKey);
    process.exit(0);
  } catch (error) {
    console.error('Failed to set API key:', error);
    process.exit(1);
  }
};

const handleSetApiKeyUnsafe = (apiKey: string): void => {
  try {
    setOpenAIKeyUnsafe(apiKey);
    process.exit(0);
  } catch (error) {
    console.error('Failed to set API key:', error);
    process.exit(1);
  }
};

const handleDeleteApiKey = (): void => {
  try {
    deleteOpenAIKey();
    process.exit(0);
  } catch (error) {
    console.error('Failed to delete API key:', error);
    process.exit(1);
  }
};

export default App;
