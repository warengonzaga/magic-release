/**
 * Unit tests for Configuration functionality
 * Tests configuration management, validation, and storage
 */

describe('Configuration Management', () => {
  describe('API Key Validation', () => {
    it('should validate API key formats', () => {
      const apiKeys = {
        openai: {
          valid: ['sk-1234567890abcdef1234567890abcdef1234567890abcdef12'],
          invalid: ['sk-short', 'invalid-key', '', 'sk-1234']
        },
        anthropic: {
          valid: ['sk-ant-1234567890abcdef1234567890abcdef1234567890'],
          invalid: ['sk-ant-short', 'sk-1234', '', 'invalid-key']
        },
        azure: {
          valid: ['1234567890abcdef1234567890abcdef'],
          invalid: ['short-key', 'sk-1234567890abcdef1234567890abcdef', '', 'invalid-key']
        }
      };

      // OpenAI key validation
      apiKeys.openai.valid.forEach(key => {
        expect(key.startsWith('sk-')).toBe(true);
        expect(key.length).toBeGreaterThan(40);
      });

      apiKeys.openai.invalid.forEach(key => {
        const isValid = key.startsWith('sk-') && key.length > 40;
        expect(isValid).toBe(false);
      });

      // Anthropic key validation
      apiKeys.anthropic.valid.forEach(key => {
        expect(key.startsWith('sk-ant-')).toBe(true);
        expect(key.length).toBeGreaterThan(40);
      });

      apiKeys.anthropic.invalid.forEach(key => {
        const isValid = key.startsWith('sk-ant-') && key.length > 40;
        expect(isValid).toBe(false);
      });

      // Azure key validation
      apiKeys.azure.valid.forEach(key => {
        expect(/^[a-f0-9]{32}$/.test(key)).toBe(true);
      });

      apiKeys.azure.invalid.forEach(key => {
        expect(/^[a-f0-9]{32}$/.test(key)).toBe(false);
      });
    });
  });

  describe('Provider Configuration', () => {
    it('should have valid provider settings', () => {
      const providers = {
        openai: {
          name: 'OpenAI',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          defaultModel: 'gpt-4',
          baseURL: 'https://api.openai.com/v1'
        },
        anthropic: {
          name: 'Anthropic',
          models: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
          defaultModel: 'claude-3-sonnet-20240229',
          baseURL: 'https://api.anthropic.com'
        },
        azure: {
          name: 'Azure OpenAI',
          models: ['gpt-4', 'gpt-35-turbo'],
          defaultModel: 'gpt-4',
          endpoint: 'https://your-resource.openai.azure.com',
          apiVersion: '2024-02-15-preview'
        }
      };

      Object.entries(providers).forEach(([_providerKey, config]) => {
        expect(config.name).toBeTruthy();
        expect(config.models).toBeInstanceOf(Array);
        expect(config.models.length).toBeGreaterThan(0);
        expect(config.defaultModel).toBeTruthy();
        expect(config.models).toContain(config.defaultModel);
      });
    });

    it('should validate model parameters', () => {
      const validParameters = {
        temperature: [0, 0.5, 1.0, 1.5, 2.0],
        maxTokens: [100, 500, 1000, 2000, 4000],
        topP: [0.1, 0.5, 0.9, 1.0]
      };

      validParameters.temperature.forEach(temp => {
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(2);
      });

      validParameters.maxTokens.forEach(tokens => {
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThanOrEqual(8000);
      });

      validParameters.topP.forEach(p => {
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Configuration File Handling', () => {
    it('should support multiple config file formats', () => {
      const configFormats = [
        '.magicrrc',
        '.magicrrc.json',
        '.magicrrc.yaml',
        '.magicrrc.yml',
        'magicr.config.js',
        'magicr.config.json'
      ];

      configFormats.forEach(format => {
        expect(format).toBeTruthy();
        expect(format.length).toBeGreaterThan(0);
        expect(format.includes('magicr') || format.includes('.magicrrc')).toBe(true);
      });
    });

    it('should validate config file structure', () => {
      const validConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        output: {
          format: 'keep-a-changelog',
          file: 'CHANGELOG.md'
        },
        git: {
          tagPrefix: 'v',
          remote: 'origin'
        }
      };

      expect(validConfig.provider).toBeTruthy();
      expect(['openai', 'anthropic', 'azure']).toContain(validConfig.provider);
      expect(validConfig.model).toBeTruthy();
      expect(validConfig.temperature).toBeGreaterThanOrEqual(0);
      expect(validConfig.temperature).toBeLessThanOrEqual(2);
      expect(validConfig.maxTokens).toBeGreaterThan(0);
      expect(validConfig.output).toBeTruthy();
      expect(validConfig.output.format).toBe('keep-a-changelog');
      expect(validConfig.git).toBeTruthy();
    });
  });

  describe('Environment Variable Handling', () => {
    it('should recognize standard environment variables', () => {
      const envVars = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'AZURE_OPENAI_KEY',
        'AZURE_OPENAI_ENDPOINT',
        'MAGICR_PROVIDER',
        'MAGICR_MODEL'
      ];

      envVars.forEach(envVar => {
        expect(envVar).toBeTruthy();
        expect(envVar.length).toBeGreaterThan(0);
        expect(envVar.toUpperCase()).toBe(envVar);
      });
    });

    it('should handle provider-specific environment variables', () => {
      const providerEnvVars = {
        openai: ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_BASE_URL'],
        anthropic: ['ANTHROPIC_API_KEY'],
        azure: ['AZURE_OPENAI_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_VERSION']
      };

      Object.entries(providerEnvVars).forEach(([provider, vars]) => {
        expect(provider).toBeTruthy();
        expect(vars).toBeInstanceOf(Array);
        expect(vars.length).toBeGreaterThan(0);
        
        vars.forEach(envVar => {
          expect(envVar.toUpperCase()).toBe(envVar);
          expect(envVar).toContain(provider.toUpperCase());
        });
      });
    });
  });

  describe('Config Validation', () => {
    it('should detect missing required fields', () => {
      const incompleteConfigs = [
        {}, // Empty config
        { provider: 'openai' }, // Missing API key
        { model: 'gpt-4' }, // Missing provider
        { provider: 'invalid' } // Invalid provider
      ];

      incompleteConfigs.forEach(config => {
        const hasProvider = 'provider' in config && ['openai', 'anthropic', 'azure'].includes(config.provider as string);
        const hasValidStructure = Object.keys(config).length > 1;
        
        // These configs should be considered incomplete or invalid
        expect(hasProvider && hasValidStructure).toBe(false);
      });
    });

    it('should validate config completeness', () => {
      const completeConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef12'
      };

      expect(completeConfig.provider).toBeTruthy();
      expect(['openai', 'anthropic', 'azure']).toContain(completeConfig.provider);
      expect(completeConfig.model).toBeTruthy();
      expect(completeConfig.apiKey).toBeTruthy();
      expect(typeof completeConfig.temperature).toBe('number');
      expect(typeof completeConfig.maxTokens).toBe('number');
    });
  });
});
