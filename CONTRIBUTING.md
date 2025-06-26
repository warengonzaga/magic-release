# 🎯 Contribute to Magic Release

Any contributions are welcome, encouraged, and valued. See the following information below for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for the maintainer and smooth out the experience for all involved. The community looks forward to your contributions. 🎉✌✨

## 📋 Code of Conduct

This project and everyone participating in it is governed by the project's [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to <opensource@warengonzaga.com>.

## 💖 How to Contribute

There are many ways to contribute to this open source project. Any contributions are welcome and appreciated. Be sure to read the details of each section for you to start contributing.

### 🧬 Development

If you can write code then create a pull request to this repo and I will review your code. Please consider submitting your pull request to the `dev` branch. I will auto reject if you submit your pull request to the `main` branch.

#### 🔧 Development Setup

To get started with development:

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/magic-release.git
   cd magic-release
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

   > ⚠️ **Important**: This project uses Yarn as the package manager. Ensure you have Yarn 4.0+ installed.

3. **Set up your development environment**

   ```bash
   # Build the project
   yarn build
   
   # Start development with watch mode
   yarn dev
   ```

4. **Test the CLI locally**

   ```bash
   # Link the package globally for testing
   yarn link
   
   # Test the CLI in a git repository
   cd /path/to/your/test-repo
   magicr --help
   ```

#### 🏗️ Development Commands

```bash
# Development with auto-reload
yarn dev

# Build for production
yarn build

# Type checking only
yarn type-check

# Clean build artifacts
yarn clean

# Linting
yarn lint              # Fix linting issues
yarn lint:check        # Check linting without fixing
yarn lint:security     # Security-focused linting

# Testing
yarn test              # Run test suite
yarn test:watch        # Run tests in watch mode
yarn test:coverage     # Run tests with coverage report

# Security scanning
yarn secure:code       # Code security analysis
yarn secure:deps       # Dependency vulnerability check
```

#### 🏛️ Project Structure

```text
src/
├── index.ts                    # Main library entry point
├── cli/                        # CLI application
│   ├── index.tsx              # CLI entry point
│   ├── App.tsx                # Main CLI app component
│   └── commands/              # CLI command handlers
├── constants/                  # Application constants
│   └── index.ts
├── core/                       # Core business logic
│   ├── MagicRelease.ts        # Main orchestrator class
│   ├── generator/             # Changelog generation
│   │   ├── ChangelogParser.ts
│   │   └── KeepChangelogGenerator.ts
│   ├── git/                   # Git operations
│   │   ├── CommitParser.ts
│   │   ├── GitService.ts
│   │   └── TagManager.ts
│   └── llm/                   # LLM integrations
│       ├── LLMService.ts
│       ├── ProviderFactory.ts
│       ├── prompts/           # AI prompts
│       └── providers/         # LLM provider implementations
├── types/                      # TypeScript type definitions
│   ├── index.ts
│   └── interfaces.ts
└── utils/                      # Utility functions
    ├── config-store.ts
    ├── errors.ts
    ├── logger.ts
    ├── package-info.ts
    └── project-config.ts
```

#### 🎯 Development Guidelines

- **TypeScript First**: All code must be written in TypeScript with strict type checking
- **Error Handling**: Implement comprehensive error handling with detailed error messages
- **Package Manager**: Use Yarn exclusively (4.0+)
- **Code Style**: Follow existing patterns and maintain consistency
- **Environment**: Use Node.js 20+ for development
- **Testing**: Write tests for new features and bug fixes
- **Security**: Follow secure coding practices, especially for API integrations
- **Documentation**: Update documentation for new features and changes

#### 🧪 Testing Guidelines

When contributing to this project:

- Write unit tests for new functionality
- Test CLI commands manually with various git repositories
- Verify LLM provider integrations work correctly
- Test error handling for edge cases
- Ensure proper handling of different git repository structures
- Test with different changelog formats and conventions
- Verify security measures (no API keys in logs, proper input validation)

#### 🔍 Code Review Process

1. **Pre-submission checks**:
   - [ ] Code builds without errors (`yarn build`)
   - [ ] TypeScript type checking passes (`yarn type-check`)
   - [ ] All tests pass (`yarn test`)
   - [ ] Linting passes (`yarn lint:check`)
   - [ ] Security checks pass (`yarn lint:security`)
   - [ ] CLI functionality works end-to-end
   - [ ] No sensitive data exposed in outputs

2. **Pull Request Requirements**:
   - [ ] Target the `dev` branch (PRs to `main` will be rejected)
   - [ ] Include clear description of changes
   - [ ] Follow existing code patterns
   - [ ] Update documentation if needed
   - [ ] Add or update tests for new functionality
   - [ ] Ensure no breaking changes without version bump

## 🏗️ Architecture & Technical Details

### 🔄 How the System Works

**Magic Release** is an AI-powered changelog generator that analyzes your git commit history and generates professional changelogs using Large Language Models (LLMs).

#### **📥 Changelog Generation Flow**

1. **Git Analysis**: Scans git repository for commits since last release tag
2. **Commit Parsing**: Extracts commit messages, authors, and metadata
3. **Content Processing**: Categorizes commits by type (features, fixes, etc.)
4. **AI Enhancement**: Uses LLM to generate professional changelog entries
5. **Format Generation**: Outputs changelog in Keep a Changelog format
6. **File Integration**: Updates CHANGELOG.md with new release section

#### **🤖 LLM Integration Architecture**

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Git Commits   │───▶│   AI Provider   │───▶│   Changelog     │
│                 │    │   (OpenAI,      │    │   Output        │
│   Raw History   │    │   Anthropic,    │    │                 │
│                 │    │   Azure, etc.)  │    │   Formatted     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### **🔧 Configuration Management**

- **Secure Config Store**: API keys stored using the `conf` package for security
- **Project Config Files**: Project-specific settings in `.magicrrc` files
- **CLI Arguments**: Runtime options and overrides
- **Automatic Detection**: Smart defaults based on repository structure

### ⚙️ Configuration Requirements

#### **LLM Provider Setup**

Magic Release uses a secure configuration store to manage API keys. Choose one of the supported providers:

**OpenAI (Default):**

```bash
# Set API key via CLI
magicr --set-api-key sk-your-openai-key

# Or set without validation (for offline setup)
magicr --set-api-key-unsafe sk-your-openai-key
```

**Anthropic:**

```bash
# First set up Anthropic as your provider
magicr --config  # Use interactive config to set provider and API key
```

**Azure OpenAI:**

```bash
# Configure Azure settings via interactive config
magicr --config  # Set provider to azure and configure endpoint/keys
```

#### **Project Configuration**

Create a `.magicrrc` file in your project root for project-specific settings:

```bash
# Generate a sample configuration file
magicr --generate-config
```

Example `.magicrrc` file:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "maxTokens": 150
  },
  "changelog": {
    "filename": "CHANGELOG.md",
    "includeCommitLinks": true,
    "includePRLinks": true,
    "includeIssueLinks": true
  },
  "git": {
    "tagPattern": "^v?\\d+\\.\\d+\\.\\d+",
    "remote": "origin"
  },
  "rules": {
    "minCommitsForUpdate": 1,
    "includePreReleases": false,
    "groupUnreleasedCommits": true
  }
}
```

### 🏗️ Installation & Deployment

#### **📦 Global Installation**

```bash
# Install globally via npm
npm install -g magicr

# Install globally via yarn
yarn global add magicr

# Verify installation
magicr --version
```

#### **🔧 Local Development Installation**

```bash
# Clone repository
git clone https://github.com/warengonzaga/magic-release.git
cd magic-release

# Install dependencies
yarn install

# Build project
yarn build

# Link for global usage
yarn link
```

#### **⚙️ Usage Examples**

```bash
# Basic usage - generate changelog for current repository
magicr

# Set up API key
magicr --set-api-key sk-your-openai-key

# Interactive configuration
magicr --config

# Generate sample project configuration
magicr --generate-config

# Test API key connectivity
magicr --test-api-key sk-your-openai-key

# Initialize project (checks git repo, creates CHANGELOG.md if needed)
magicr --init

# Show help and available options
magicr --help
```

### 🛡️ Security Best Practices

#### **API Key Management**

- Store API keys using the built-in secure config store (`magicr --set-api-key`)
- Never commit API keys to version control
- Use `.gitignore` to exclude configuration files with sensitive data
- Rotate API keys regularly
- Monitor API usage for unusual activity

#### **Input Validation**

- All git repository paths are validated
- Commit message content is sanitized
- File paths prevent directory traversal attacks
- Configuration values are type-checked and validated

#### **Output Security**

- Generated changelogs are sanitized to prevent injection attacks
- No sensitive information (API keys, internal paths) included in output
- Proper error handling prevents information disclosure
- Audit logging for security-relevant operations

## 🐞 Bug Reports & Feature Requests

### 🐞 Reporting Bugs

For security bugs, please follow our [Security Policy](./SECURITY.md).

For other bugs, please create an issue with:

- Clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (Node.js version, OS, LLM provider)
- Relevant logs or error messages (without sensitive data)
- Git repository characteristics (if relevant)

### 💡 Feature Requests

We welcome suggestions for new features! Please create an issue with:

- Clear description of the feature
- Use case and benefits
- Any implementation considerations
- Examples or mockups if applicable
- Integration considerations with existing functionality

### 📖 Documentation

Improvements to documentation are always welcome! This includes:

- README updates
- Code comments and JSDoc documentation
- CLI help text improvements
- Configuration examples
- Troubleshooting guides
- API documentation
- Fixing typos or clarifying existing documentation

## 🎯 Project Status

### Current Focus (v0.1.x)

- Core changelog generation functionality
- Support for major LLM providers (OpenAI, Anthropic, Azure)
- CLI interface with essential commands
- Git repository analysis and commit parsing
- Keep a Changelog format support
- Secure configuration management

### Potential Future Enhancements

- Additional changelog formats
- Enhanced commit categorization
- Custom prompt templates
- Improved error handling and user experience
- Performance optimizations

> **Note**: This project is in active development. Feature requests and contributions are welcome!

## 📚 Resources

- [Keep a Changelog](https://keepachangelog.com/) - Changelog format specification
- [Semantic Versioning](https://semver.org/) - Version numbering guidelines
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message conventions
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)

---

💻 with ❤️ by [Waren Gonzaga](https://warengonzaga.com), [WG Technology Labs](https://wgtechlabs.com), and [Him](https://www.youtube.com/watch?v=HHrxS4diLew&t=44s) 🙏
