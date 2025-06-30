# Magic Release 🪄 [![author/maintainer](https://img.shields.io/badge/by-warengonzaga-016eea.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://warengonzaga.com/) [![nominate](https://img.shields.io/badge/nominate-%20@warengonzaga%20as%20GitHub%20Star-yellow.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://stars.github.com/nominate)

[![member of ossph](https://img.shields.io/badge/member-OSS%20PH-0060a0.svg?logo=github&longCache=true&labelColor=181717&style=flat-square)](https://github.com/ossphilippines) [![sponsors](https://img.shields.io/badge/sponsor-%E2%9D%A4-%23db61a2.svg?&logo=github&logoColor=white&labelColor=181717&style=flat-square)](https://github.com/sponsors/warengonzaga) [![release](https://img.shields.io/github/release/warengonzaga/magic-release.svg?logo=github&labelColor=181717&color=green&style=flat-square)](https://github.com/warengonzaga/magic-release/releases) [![star](https://img.shields.io/github/stars/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&color=yellow&style=flat-square)](https://github.com/warengonzaga/magic-release/stargazers) [![license](https://img.shields.io/github/license/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&style=flat-square)](https://github.com/warengonzaga/magic-release/blob/main/license) [![NPM Installs](https://img.shields.io/npm/dt/magicr?color=CB3837&logo=npm&label=installs&labelColor=181717&style=flat-square)](https://npmjs.com/package/magicr)

<!-- ![banner](https://your-banner-url.com) -->

> 🪄 AI-powered changelog generator that transforms your Git commit history into beautiful, professional changelogs following Keep a Changelog standards.

Magic Release automatically generates comprehensive, well-structured changelogs from your Git commit history using advanced AI. Simply run `magicr` in your repository and watch as it intelligently categorizes commits, creates semantic release notes, and produces professional documentation that your users will love. ✨

## ✨ Key Features

- 🤖 **Multiple AI Providers** - Support for OpenAI GPT-4, Anthropic Claude, and Azure OpenAI
- 📋 **Keep a Changelog Format** - Industry-standard changelog structure and formatting
- 🎯 **Smart Categorization** - AI-powered commit analysis into features, fixes, breaking changes, and more
- ⚡ **Zero Configuration** - Works out of the box with intelligent defaults
- 🛠️ **Flexible Setup** - Interactive configuration wizard and project initialization
- 🔍 **Range Support** - Generate changelogs for specific commit ranges or versions
- 🚀 **No Installation Required** - Use with `npx` without global installation
- 📝 **Conventional Commits** - Full support for conventional commit format
- 🔗 **Smart Linking** - Automatic GitHub/GitLab issue and PR linking
- 🎨 **Customizable** - Configurable output format and content inclusion

Have suggestions? [Let me know!](https://github.com/warengonzaga/magic-release/issues)

> [!IMPORTANT]  
> This project is currently in beta (v0.1.0-beta). While fully functional, expect occasional improvements and refinements. Report any issues you encounter - your feedback helps make it better! 🙏

## 🚀 Quick Start

Get up and running in seconds with these simple steps:

### Option 1: Use with npx (Recommended)

```bash
# Navigate to your project
cd your-project

# Generate changelog instantly
npx magicr

# Or with custom options
npx magicr --from v1.0.0 --to HEAD --verbose
```

### Option 2: Global Installation

```bash
# Install globally
npm install -g magicr

# Use anywhere
cd your-project
magicr
```

### What happens when you run it

1. 🔍 **Analyzes** your Git commit history intelligently
2. 🤖 **Categorizes** commits using AI into proper changelog sections
3. 📝 **Generates** a beautiful `CHANGELOG.md` following Keep a Changelog standards
4. 🎯 **Preserves** existing changelog content and adds new entries
5. 🔗 **Links** to issues, PRs, and commits automatically

## 😎 Demo

> 📹 Coming soon! In the meantime, try it out in your project.

### Common Commands

```bash
# Basic usage - generate changelog from all commits
magicr
# or with npx
npx magicr

# Generate changelog from specific commit range
magicr --from v1.0.0 --to v2.0.0
# or with npx
npx magicr --from v1.0.0 --to v2.0.0

# Preview without writing files
magicr --dry-run

# Include verbose output for debugging
magicr --verbose

# Set up API key (auto-detects OpenAI)
magicr --set-key sk-your-openai-key
# or with npx
npx magicr --set-key sk-your-openai-key

# Interactive configuration setup
magicr --config

# Initialize project configuration
magicr --init

# Switch or list AI providers
magicr --provider
```

> [!NOTE]
> Magic Release supports multiple AI providers including OpenAI, Anthropic, and Azure OpenAI. By default, it uses OpenAI's `gpt-4o-mini` model. You'll need an API key from your chosen provider:
>
> **OpenAI:** Get your API key at [platform.openai.com](https://platform.openai.com/api-keys)
> **Anthropic:** Get your API key at [console.anthropic.com](https://console.anthropic.com/)
> **Azure OpenAI:** Configure through your Azure portal
>
> ```bash
> # Set up your API key (auto-detects provider)
> magicr --set-key your-api-key
> # or with npx
> npx magicr --set-key your-api-key
>
> # Or specify provider explicitly
> magicr --provider anthropic --set-key your-anthropic-key
> # or with npx
> npx magicr --provider anthropic --set-key your-anthropic-key
> ```

## 📦 Installation

**Requirements:**

- Node.js ≥ 20.0.0
- Yarn ≥ 4.0.0 (recommended) or npm

### Global Installation

```bash
# Using npm
npm install -g magicr

# Using yarn
yarn global add magicr
```

### Using npx (No Installation Required)

```bash
# Run directly without installing
npx magicr

# You can use all the same options
npx magicr --set-key your-api-key
npx magicr --from v1.0.0 --to v2.0.0
```

## 💖 Motivation

Creating and maintaining changelogs is often a tedious, time-consuming task that many developers either skip or do inconsistently. Magic Release was born from the frustration of manually categorizing commits, writing user-friendly descriptions, and maintaining proper changelog formatting across multiple projects.

By leveraging the power of modern AI, Magic Release transforms this chore into an effortless, automated process. It not only saves countless hours but also ensures consistency, professionalism, and adherence to industry standards like Keep a Changelog format.

**The vision:** Every project deserves a professional changelog that helps users understand what changed, when, and why - without the developer overhead. 🎯

## 🏗️ Architecture

Magic Release is built with a modular, extensible architecture:

### Core Components

- **🧠 LLM Service** - Unified interface supporting multiple AI providers
- **📝 Commit Parser** - Analyzes conventional commits and semantic patterns  
- **🏷️ Tag Manager** - Handles version detection and semantic versioning
- **📊 Git Service** - Interfaces with Git repository operations
- **📄 Changelog Generator** - Produces Keep a Changelog format output
- **⚙️ Configuration Store** - Secure credential and settings management

### Supported AI Providers

- **OpenAI** - GPT-4, GPT-3.5 Turbo models
- **Anthropic** - Claude 3 family models
- **Azure OpenAI** - Enterprise-grade AI with custom deployments

### Data Flow

1. **Repository Analysis** → Extract commits, tags, and metadata
2. **AI Processing** → Categorize and enhance commit descriptions  
3. **Content Generation** → Create structured changelog entries
4. **Format & Output** → Generate final changelog following standards

## 🎯 Contributing

We welcome contributions! Here's how you can help make Magic Release even better:

### Ways to Contribute

- 🐛 **Report bugs** - Found an issue? [Create a bug report](https://github.com/warengonzaga/magic-release/issues/new?template=bug_report.md)
- 💡 **Request features** - Have an idea? [Suggest a feature](https://github.com/warengonzaga/magic-release/issues/new?template=feature_request.md)
- 📝 **Improve docs** - Help us make the documentation clearer
- 🔧 **Submit PRs** - Fix bugs or implement new features
- ⭐ **Give feedback** - Share your experience using Magic Release

### Development Setup

```bash
# Clone the repository
git clone https://github.com/warengonzaga/magic-release.git
cd magic-release

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Test locally
npm run dev
```

### Contributing Guidelines

- Please read our [Contributing Guide](https://github.com/warengonzaga/magic-release/blob/main/CONTRIBUTING.md) first
- Submit pull requests to the `dev` branch
- Follow the existing code style and conventions
- Add tests for new features
- Update documentation as needed

**Your contributions help make changelog generation effortless for developers worldwide!** 🌍

## 🐛 Issues

Please report any issues and bugs by [creating a new issue here](https://github.com/warengonzaga/magic-release/issues/new/choose), also make sure you're reporting an issue that doesn't exist. Any help to improve the project would be appreciated. Thanks! 🙏✨

## 🙏 Sponsor

Like this project? Leave a star! ⭐⭐⭐⭐⭐

Want to support my work and get some perks? [Become a sponsor](https://github.com/sponsors/warengonzaga)! 💖

Or, you just love what I do? [Buy me a coffee](https://buymeacoffee.com/warengonzaga)! ☕

Recognized my open-source contributions? [Nominate me](https://stars.github.com/nominate) as GitHub Star! 💫

## 📋 Code of Conduct

Read the project's [code of conduct](https://github.com/warengonzaga/magic-release/blob/main/CODE_OF_CONDUCT.md).

## 📃 License

This project is licensed under [GNU General Public License v3.0](https://opensource.org/licenses/GPL-3.0).

## 📝 Author

This project is created by [Waren Gonzaga](https://github.com/warengonzaga), with the help of awesome [contributors](https://github.com/warengonzaga/magic-release/graphs/contributors).

[![contributors](https://contrib.rocks/image?repo=warengonzaga/magic-release)](https://github.com/warengonzaga/magic-release/graphs/contributors)

💻 with ❤️ by [Waren Gonzaga](https://warengonzaga.com/) and [Him](https://www.youtube.com/watch?v=HHrxS4diLew&t=44s) 🙏
