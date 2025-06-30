# Magic Release 🪄 [![author/maintainer](https://img.shields.io/badge/by-warengonzaga-016eea.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://warengonzaga.com/) [![nominate](https://img.shields.io/badge/nominate-%20@warengonzaga%20as%20GitHub%20Star-yellow.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://stars.github.com/nominate)

[![member of ossph](https://img.shields.io/badge/member-OSS%20PH-0060a0.svg?logo=github&longCache=true&labelColor=181717&style=flat-square)](https://github.com/ossphilippines) [![sponsors](https://img.shields.io/badge/sponsor-%E2%9D%A4-%23db61a2.svg?&logo=github&logoColor=white&labelColor=181717&style=flat-square)](https://github.com/sponsors/warengonzaga) [![release](https://img.shields.io/github/release/warengonzaga/magic-release.svg?logo=github&labelColor=181717&color=green&style=flat-square)](https://github.com/warengonzaga/magic-release/releases) [![star](https://img.shields.io/github/stars/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&color=yellow&style=flat-square)](https://github.com/warengonzaga/magic-release/stargazers) [![license](https://img.shields.io/github/license/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&style=flat-square)](https://github.com/warengonzaga/magic-release/blob/main/license) [![NPM Installs](https://img.shields.io/npm/dt/magicr?color=CB3837&logo=npm&label=installs&labelColor=181717&style=flat-square)](https://npmjs.com/package/magicr)

<!-- ![banner](https://your-banner-url.com) -->

> AI-powered changelog generator from your commit history, built for dev workflows. 🪄📝💻

Magic Release automatically generates beautiful, structured changelogs from your Git commit history using AI. Simply run `magicr` in your repository and watch as it creates professional changelogs following Keep a Changelog format. 🚀

**Key Features:**

- 🤖 **Multiple AI Providers** - OpenAI, Anthropic, Azure OpenAI support
- 📋 **Keep a Changelog Format** - Industry-standard changelog structure
- 🎯 **Smart Categorization** - Automatically sorts commits into features, fixes, breaking changes
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🛠️ **Flexible Setup** - Interactive configuration and project initialization
- 🔍 **Range Support** - Generate changelogs for specific commit ranges
- 🚀 **No Installation Required** - Use with `npx` without global installation

Have suggestions in mind? [Let me know!](https://github.com/warengonzaga/magic-release/issues)

> [!IMPORTANT]
> This project is still in its early stage (v0.1.0-beta) so expect some bugs and issues. Please report any issues you encounter. Thank you! 🙏

Like this project? Leave a star! ⭐⭐⭐⭐⭐

## 😎 Demo

> Coming soon! 📹

### Quick Start

```bash
# Option 1: Install globally
npm install -g magicr
cd your-project
magicr

# Option 2: Use with npx (no installation needed)
cd your-project
npx magicr
```

This will automatically:

- 🔍 Analyze your Git commit history
- 🤖 Categorize commits using AI (Features, Bug Fixes, Breaking Changes, etc.)
- 📝 Generate a beautiful `CHANGELOG.md` file
- 🎯 Follow Keep a Changelog format standards
- 📋 Create proper version sections and release notes

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

I created this project because I wanted a simple, AI-powered tool to automatically generate changelogs that follow industry standards. Managing changelogs manually is time-consuming and often inconsistent. Magic Release solves this by analyzing your Git history and creating professional changelogs automatically. 🎯

## 🎯 Contributing

Contributions are welcome, create a pull request to this repo and I will review your code. Please consider submitting your pull request to the `dev` branch. Thank you!

Read the project's [contributing guide](https://github.com/warengonzaga/magic-release/blob/main/CONTRIBUTING.md) for more info.

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
