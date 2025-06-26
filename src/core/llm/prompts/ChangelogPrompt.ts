/**
 * Changelog Prompt Templates
 * Provides structured prompts for LLM changelog generation
 */

import type { Commit, MagicReleaseConfig } from '../../../types/index.js';

export interface PromptContext {
  projectName?: string;
  projectDescription?: string;
  version?: string;
  previousChangelog?: string;
  commits: Commit[];
  repository?: {
    owner: string;
    name: string;
    url: string;
  };
}

export class ChangelogPrompt {
  constructor(_config: MagicReleaseConfig) {
    // Config is stored for future use
  }

  /**
   * Generate system prompt for changelog generation
   */
  getSystemPrompt(): string {
    return `You are an expert changelog generator that follows the "Keep a Changelog" format (https://keepachangelog.com/).

Your task is to:
1. Analyze git commit messages and categorize changes into: Added, Changed, Deprecated, Removed, Fixed, Security
2. Generate clean, user-friendly descriptions that focus on the impact for end users
3. Group related changes together when appropriate
4. Use clear, concise language that non-technical users can understand
5. Focus on benefits and impacts, not implementation details

Format Guidelines:
- Follow Keep a Changelog format exactly
- Use markdown formatting
- Start each category with ### [Category]
- Use bullet points (- ) for individual changes
- Include relevant issue/PR references when available
- Avoid technical jargon when possible
- Focus on user-facing changes and their benefits

Categories (only include if there are changes):
- **Added** for new features
- **Changed** for changes in existing functionality  
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

Guidelines for descriptions:
- Start with action verbs (Add, Fix, Update, Remove, etc.)
- Be specific about what changed and why it matters to users
- Group related commits into single, coherent entries
- Prioritize user-facing changes over internal refactoring
- Use consistent tone and style

Do not include:
- Empty categories
- Internal refactoring unless it impacts users
- Minor code style changes
- Dependency updates unless they add features or fix issues
- Build system changes unless they affect end users`;
  }

  /**
   * Generate user prompt with commit data
   */
  getUserPrompt(context: PromptContext): string {
    let prompt = `Generate a changelog entry for the following commits:\n\n`;

    // Add project context if available
    if (context.projectName ?? context.projectDescription) {
      prompt += `Project Context:\n`;
      if (context.projectName) {
        prompt += `- Name: ${context.projectName}\n`;
      }
      if (context.projectDescription) {
        prompt += `- Description: ${context.projectDescription}\n`;
      }
      prompt += `\n`;
    }

    // Add version if specified
    if (context.version) {
      prompt += `Target Version: ${context.version}\n\n`;
    }

    // Add commits
    prompt += `Commits to analyze:\n`;
    for (const commit of context.commits) {
      prompt += `- ${commit.message}`;

      if (commit.hash) {
        prompt += ` (${commit.hash.substring(0, 7)})`;
      }

      if (commit.author) {
        prompt += ` by ${commit.author}`;
      }

      if (commit.pr) {
        prompt += ` [PR #${commit.pr}]`;
      }

      if (commit.issues?.length) {
        prompt += ` [Issues: ${commit.issues.map((i: string) => `#${i}`).join(', ')}]`;
      }

      prompt += `\n`;

      // Add body if available and meaningful
      if (commit.body && commit.body.length > 20) {
        const body = commit.body.substring(0, 200);
        prompt += `  Body: ${body}${commit.body.length > 200 ? '...' : ''}\n`;
      }
    }

    // Add style reference if previous changelog exists
    if (context.previousChangelog) {
      prompt += `\nPrevious changelog for style reference:\n`;
      // Include only first few entries to avoid token limit
      const lines = context.previousChangelog.split('\n');
      const relevantLines = lines.slice(0, 50); // First 50 lines should be enough
      prompt += relevantLines.join('\n');
      if (lines.length > 50) {
        prompt += '\n[... rest of changelog truncated for brevity]';
      }
      prompt += `\n`;
    }

    prompt += `\nPlease generate a well-organized changelog entry that follows the Keep a Changelog format. Focus on user-facing changes and their benefits. Group related changes together when appropriate.

Return only the changelog section content (starting with ### categories), not the full changelog structure.`;

    return prompt;
  }

  /**
   * Generate prompt for commit categorization
   */
  getCategorizationPrompt(commitMessage: string): string {
    return `Categorize the following git commit message into one of these changelog categories:

Categories:
- Added: new features
- Changed: changes in existing functionality
- Deprecated: soon-to-be removed features
- Removed: now removed features
- Fixed: any bug fixes
- Security: vulnerability fixes

Commit message: ${commitMessage}

Respond with only the category name (Added, Changed, Deprecated, Removed, Fixed, or Security).`;
  }

  /**
   * Generate prompt for release summary
   */
  getReleaseSummaryPrompt(changelogContent: string): string {
    return `Create a concise, engaging release summary based on this changelog content:

${changelogContent}

The summary should:
- Highlight the most important changes
- Be written for end users, not developers
- Focus on benefits and improvements
- Be 2-3 sentences maximum
- Use an enthusiastic but professional tone

Return only the summary text, no additional formatting.`;
  }

  /**
   * Generate prompt for version suggestion
   */
  getVersionSuggestionPrompt(changes: string[], currentVersion?: string): string {
    const changesText = changes.join('\n- ');

    let prompt = `Based on these changes, suggest the next version number following Semantic Versioning (semver.org):

Changes:
- ${changesText}

`;

    if (currentVersion) {
      prompt += `Current version: ${currentVersion}\n\n`;
    }

    prompt += `Semantic Versioning rules:
- MAJOR version: incompatible API changes or breaking changes
- MINOR version: backwards-compatible functionality additions
- PATCH version: backwards-compatible bug fixes

Respond with only the suggested version number (e.g., "1.2.3").`;

    return prompt;
  }

  /**
   * Generate structured prompt for batch commit processing
   */
  getBatchProcessingPrompt(commits: Commit[]): string {
    return `Process these commits and return a JSON structure with categorized changes:

${this.formatCommitsForPrompt(commits)}

Return a JSON object with this structure:
{
  "Added": ["description1", "description2"],
  "Changed": ["description1"],
  "Fixed": ["description1", "description2"],
  "Security": [],
  "Removed": [],
  "Deprecated": []
}

Only include categories that have changes. Make descriptions user-friendly and focus on impact.`;
  }

  /**
   * Format commits for prompt inclusion
   */
  private formatCommitsForPrompt(commits: Commit[]): string {
    return commits
      .map(commit => {
        let line = `- ${commit.message}`;

        if (commit.type && commit.scope) {
          line += ` [Type: ${commit.type}, Scope: ${commit.scope}]`;
        } else if (commit.type) {
          line += ` [Type: ${commit.type}]`;
        }

        if (commit.breaking) {
          line += ` [BREAKING CHANGE]`;
        }

        if (commit.hash) {
          line += ` (${commit.hash.substring(0, 7)})`;
        }

        return line;
      })
      .join('\n');
  }

  /**
   * Generate prompt for breaking changes detection
   */
  getBreakingChangesPrompt(commits: Commit[]): string {
    return `Analyze these commits and identify breaking changes that would require a major version bump:

${this.formatCommitsForPrompt(commits)}

Breaking changes include:
- API changes that break backwards compatibility
- Removed features or functions
- Changed behavior that could break existing code
- Dependency updates that require user action

Return a JSON array of breaking change descriptions, or an empty array if none found:
["description1", "description2"]`;
  }
}

export default ChangelogPrompt;
