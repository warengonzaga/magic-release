# Repository Guidelines for AI Agents

This document provides essential information for AI agents working with the Magic Release repository.

## Project Overview

**Magic Release** is an AI-powered changelog generator that transforms Git commit history into beautiful, professional changelogs following Keep a Changelog standards.

- **Language**: TypeScript
- **Runtime**: Node.js ≥ 20.0.0
- **Package Manager**: PNPM ≥ 9.0.0
- **License**: GPL-3.0

## Project Structure & Key Files

- **Source code**: `src/` - All TypeScript source files
  - `src/cli/` - CLI application and commands
  - `src/core/` - Core business logic (MagicRelease, generators, git, llm)
  - `src/types/` - TypeScript type definitions
  - `src/utils/` - Utility functions
- **Configuration**: `package.json`, `tsconfig.json`, `tsup.config.ts`
- **Documentation**: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- **Build output**: `dist/` - Compiled JavaScript (not committed)

## Build, Test, and Development Commands

```bash
# Install dependencies
pnpm install

# Development with watch mode
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint              # Fix linting issues
pnpm lint:check        # Check without fixing
pnpm lint:security     # Security-focused linting

# Testing
pnpm test              # Run test suite
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Run with coverage

# Security
pnpm secure            # Run all security checks
pnpm secure:scan       # Dependency vulnerabilities
pnpm secure:code       # Code security analysis

# Format code
pnpm format            # Format all files
pnpm format:check      # Check formatting

# Validation
pnpm validate          # Lint + test + build
pnpm validate:full     # Full validation with security
```

## Coding Style & Naming Conventions

- **TypeScript**: Strict type checking enabled; all code must be TypeScript
- **Code Style**: Follow existing patterns; use ESLint and Prettier configurations
- **Formatting**: 2-space indentation, single quotes, semicolons (enforced by Prettier)
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Security**: Follow secure coding practices, especially for API integrations
- **Imports**: Use ES modules (type: "module" in package.json)
- **File Naming**: PascalCase for classes (e.g., `GitService.ts`), camelCase for utilities

## Commit Message Convention

This project follows the **Clean Commit** workflow. See `.github/copilot-instructions.md` for details.

**Format**: `<emoji> <type>: <description>` or `<emoji> <type> (<scope>): <description>`

**Common types:**
- 📦 `new`: New features or functionality
- 🔧 `update`: Changes to existing code
- 🗑️ `remove`: Removing code or features
- 🔒 `security`: Security fixes
- ⚙️ `setup`: Config, CI/CD, tooling
- ☕ `chore`: Maintenance, dependencies
- 🧪 `test`: Test files
- 📖 `docs`: Documentation
- 🚀 `release`: Version releases

## Testing Guidelines

- Write unit tests for new functionality
- Test CLI commands manually with various git repositories
- Verify LLM provider integrations work correctly
- Test error handling for edge cases
- Ensure proper handling of different git repository structures
- Test with different changelog formats and conventions
- Verify security measures (no API keys in logs, proper input validation)

## Pull Request & Contribution Guidelines

- **Target branch**: Submit PRs to `dev` branch (PRs to `main` will be rejected)
- **Pre-submission checks**:
  - Code builds without errors (`pnpm build`)
  - TypeScript type checking passes (`pnpm type-check`)
  - All tests pass (`pnpm test`)
  - Linting passes (`pnpm lint:check`)
  - Security checks pass (`pnpm lint:security`)
- **PR Requirements**:
  - Clear description of changes
  - Follow existing code patterns
  - Update documentation if needed
  - Add or update tests for new functionality
  - No breaking changes without version bump

## Security & Best Practices

- **Never commit secrets**: API keys stored using secure config store
- **Input Validation**: All git paths validated, commit messages sanitized
- **Output Security**: Generated changelogs sanitized, no sensitive info in output
- **API Key Management**: Use built-in secure config store, rotate keys regularly
- **Dependencies**: Keep updated, run security scans regularly

## Architecture Overview

**Core Components:**
- **LLM Service**: Unified interface for OpenAI, Anthropic, Azure OpenAI
- **Commit Parser**: Analyzes conventional commits and semantic patterns
- **Tag Manager**: Handles version detection and semantic versioning
- **Git Service**: Git repository operations interface
- **Changelog Generator**: Produces Keep a Changelog format output
- **Configuration Store**: Secure credential and settings management

**Data Flow:**
1. Repository Analysis → Extract commits, tags, metadata
2. AI Processing → Categorize and enhance commit descriptions
3. Content Generation → Create structured changelog entries
4. Format & Output → Generate final changelog following standards

## Additional Resources

- [Contributing Guide](./CONTRIBUTING.md) - Detailed contribution instructions
- [Keep a Changelog](https://keepachangelog.com/) - Changelog format specification
- [Semantic Versioning](https://semver.org/) - Version numbering guidelines
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit conventions
- [Clean Commit](https://github.com/wgtechlabs/clean-commit) - Commit workflow
