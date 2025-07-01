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
   *
   * Creates a comprehensive system prompt that instructs the LLM to act as an expert
   * commit message rewriter following the "Keep a Changelog" format. The prompt includes:
   *
   * - Clear AI instruction format with purpose and steps
   * - Guidelines for rephrasing commit messages into present imperative tense
   * - Instructions to eliminate emojis and formatting tags
   * - Examples of proper transformations
   * - Keep a Changelog categorization rules
   * - Output formatting requirements
   *
   * This enhanced prompt incorporates the AI Instruction: Commit Message Rewriter
   * methodology to ensure consistent, human-readable changelog entries.
   *
   * @returns System prompt string for LLM changelog generation
   */
  getSystemPrompt(): string {
    return `You are an expert commit message rewriter for changelogs that follows the "Keep a Changelog" format (https://keepachangelog.com/).

### 🧠 AI Instruction: Commit Message Rewriter for Changelogs

**Purpose**:  
Rephrase developer commit messages into human-readable changelog entries that conform to the Keep a Changelog format while preserving the original intent.

**Input**:  
Raw commit messages (format-agnostic), optionally including emojis or tags.

**Output Format**:
\`\`\`markdown
### [Section]  
- [Commit summary in present imperative tense] ([commit hash])
\`\`\`

**Steps**:

1. **Determine Changelog Section** (\`Added\`, \`Changed\`, \`Fixed\`, \`Removed\`, etc.)  
   - Use semantic cues from the commit message to classify the entry.

2. **Rephrase Message**  
   - Use **present imperative tense** (e.g. "Update", "Fix", "Remove").  
   - Capitalize the first word.  
   - Eliminate emojis and tags (e.g. \`✨\`, \`fix:\`).  
   - Make it concise and clear to both technical and non-technical audiences.

3. **Format Entry**  
   - Convert into a bullet point with the rephrased message.  
   - Append the **commit hash** in parentheses (if available).

**Example**:
\`\`\`
Input: ✨ tweak: replace the color in chat input  
Output: - Replace color in chat input (abc1234)
\`\`\`

Additional Rephrasing Examples:
- "🐛 fixed the dropdown issue" → "Fix dropdown functionality issue"
- "feat: adds new user management feature" → "Add user management feature"
- "refactored the payment module" → "Refactor payment module structure"
- "chore: update dependencies" → "Update project dependencies"

Format Guidelines:
- Follow Keep a Changelog format exactly
- Use markdown formatting with ### for categories
- Use bullet points (- ) for individual changes
- Include commit hash in parentheses: (abc1234)
- Only include categories that have changes
- Group similar changes when appropriate

Categories (only include if there are changes):
- **Added** for new features and capabilities
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes and corrections
- **Security** for vulnerability fixes and security improvements

Do not include:
- Empty categories
- Minor whitespace or formatting changes
- Trivial dependency updates
- Internal refactoring that doesn't affect users
- Build system changes that don't impact end users`;
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
    prompt += `Commits to analyze and rephrase:\n`;
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

    prompt += `\nPlease:
1. Rephrase each commit message into clear, present imperative tense
2. Categorize each rephrased entry into the appropriate Keep a Changelog category
3. Format as bullet points under each category header
4. Include the commit hash with each entry
5. Focus on what the change accomplishes for users

Expected output format:
### Added
- Rephrased commit description (abc1234)
- Another rephrased description (def5678)

### Fixed
- Rephrased bug fix description (ghi9012)

Only include categories that have actual changes.\n\n`;

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
