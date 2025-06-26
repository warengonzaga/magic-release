# Magic Release 🚀 [![author/maintainer](https://img.shields.io/badge/by-warengonzaga-016eea.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://warengonzaga.com/) [![nominate](https://img.shields.io/badge/nominate-%20@warengonzaga%20as%20GitHub%20Star-yellow.svg?logo=github&labelColor=181717&longCache=true&style=flat-square)](https://stars.github.com/nominate)

[![made with](https://img.shields.io/badge/made%20with-TypeScript-blue.svg?logo=typescript&labelColor=181717&color=blue&logoColor=white&style=flat-square)](https://www.typescriptlang.org/) [![release](https://img.shields.io/github/release/warengonzaga/magic-release.svg?logo=github&labelColor=181717&color=green&style=flat-square)](https://github.com/warengonzaga/magic-release/releases) [![star](https://img.shields.io/github/stars/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&color=yellow&style=flat-square)](https://github.com/warengonzaga/magic-release/stargazers) [![license](https://img.shields.io/github/license/warengonzaga/magic-release.svg?&logo=github&labelColor=181717&style=flat-square)](https://github.com/warengonzaga/magic-release/blob/main/LICENSE) [![NPM Downloads](https://img.shields.io/npm/dt/magicr?logo=npm&labelColor=181717&color=red&style=flat-square)](https://npmjs.com/package/magicr)

<!-- ![banner](https://your-banner-url.com) -->

> AI-powered changelog generator from your commit history, built for dev workflows. 🪄📝

Magic Release automatically generates beautiful, structured changelogs from your Git commit history using AI. Just type `magicr` and watch as it creates professional changelogs following Keep a Changelog format. It uses `gpt-4o-mini` as the default model from OpenAI to analyze and categorize your commits. 🚀

Have suggestions in mind? [Let me know!](https://github.com/warengonzaga/magic-release/issues)

> [!IMPORTANT]
> This project is still in its early stage (v0.1.0-beta) so expect some bugs and issues. Please report any issues you encounter. Thank you! 🙏

Like this project? Leave a star! ⭐⭐⭐⭐⭐

## 😎 Demo

> Coming soon! 📹

## 🕹️ Usage

Navigate to your Git repository and run:

```bash
magicr
```

This will automatically:

- Analyze your commit history
- Categorize commits using AI
- Generate a beautiful `CHANGELOG.md` file
- Follow Keep a Changelog format standards

### Common Commands

```bash
# Generate changelog from specific commit range
magicr --from v1.0.0 --to HEAD

# Dry run to preview without writing files
magicr --dry-run

# Include verbose output for debugging
magicr --verbose

# Set up OpenAI API key
magicr --set-api-key

# Generate sample configuration
magicr --generate-config
```

> [!NOTE]
> To work properly, it requires an API key from [OpenAI](https://openai.com/) to use the GPT-4o-mini model. You can get your API key by signing up on their website. Once you have the API key, set it up by running:
>
> ```bash
> magicr --set-api-key
> ```

## 📦 Installation

You can install this project via `npm` or `yarn`.

```bash
npm install -g magicr
```

or

```bash
yarn global add magicr
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
