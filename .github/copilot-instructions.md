# Commit Message Workflow

This project uses the **Clean Commit** workflow for all commits.

## Format

```
<emoji> <type>: <description>
```

or with optional scope:

```
<emoji> <type> (<scope>): <description>
```

## The 9 Types

| Emoji | Type | Usage |
|-------|------|-------|
| 📦 | `new` | New features, files, or capabilities |
| 🔧 | `update` | Changes to existing code, refactoring |
| 🗑️ | `remove` | Removing code, files, features, dependencies |
| 🔒 | `security` | Security fixes, patches, vulnerabilities |
| ⚙️ | `setup` | Configs, CI/CD, tooling, .github files |
| ☕ | `chore` | Maintenance, dependencies, LICENSE |
| 🧪 | `test` | Test files and testing |
| 📖 | `docs` | README, guides, documentation |
| 🚀 | `release` | Version releases and tags |

## Rules

- Use lowercase for type
- Use present tense ("add" not "added")
- No period at the end
- Keep description under 72 characters
- Optional scope in parentheses after type

## Examples

### New Features
```
📦 new: user authentication system
📦 new (cli): add interactive provider selection
📦 new (llm): support for azure openai
```

### Updates & Changes
```
🔧 update: improve changelog parsing logic
🔧 update (git): optimize commit history analysis
🔧 update (core): refactor magic release orchestrator
```

### Removing Code
```
🗑️ remove: deprecated legacy authentication
🗑️ remove (deps): unused lodash dependency
🗑️ remove (cli): obsolete command options
```

### Security Fixes
```
🔒 security: sanitize user input in commit parser
🔒 security (api): validate llm api responses
🔒 security: update dependencies with known CVEs
```

### Project Setup
```
⚙️ setup: configure github actions workflow
⚙️ setup (ci): add security scanning step
⚙️ setup: initialize eslint security config
```

### Maintenance
```
☕ chore: update npm dependencies
☕ chore (deps): bump openai to latest version
☕ chore: clean up unused imports
```

### Testing
```
🧪 test: add unit tests for commit parser
🧪 test (integration): llm provider connectivity
🧪 test: fix flaky date parsing test
```

### Documentation
```
📖 docs: update installation instructions
📖 docs (api): add llm provider configuration
📖 docs: fix typos in contributing guide
```

### Releases
```
🚀 release: version 1.0.0
🚀 release: prepare for 2.0.0 release
🚀 release: hotfix version 1.0.1
```

## Reference

For more information about Clean Commit workflow, see:
https://github.com/wgtechlabs/clean-commit
