# 🔒 Security Policy

## 🛡️ Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## 🚨 Reporting Security Vulnerabilities

If you identify any security vulnerabilities or concerns within this repository, please report them promptly by emailing us at [security@warengonzaga.com](mailto:security@warengonzaga.com).

**Please do NOT report security vulnerabilities through public GitHub issues.**

> [!NOTE]
> As an open-source project, we don't offer monetary bug bounties. However, we provide meaningful recognition and community acknowledgment for security researchers who help improve our project.

### What to Include in Your Report

When reporting a security vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Impact**: Potential impact and severity assessment
- **Steps to Reproduce**: Detailed steps to reproduce the vulnerability
- **Environment**: Node.js version, operating system, LLM provider, and other relevant details
- **Proof of Concept**: If possible, include a minimal reproduction case
- **Affected Components**: Specify whether it affects the CLI, core logic, LLM integration, or other components

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Regular updates every 3-5 business days
- **Resolution**: We aim to resolve critical vulnerabilities within 7 days

### Recognition and Rewards

As an open-source organization, we don't currently offer monetary rewards for vulnerability reports. However, we deeply value your contributions and offer the following recognition:

- **Public Acknowledgment**: Credit in our security advisories and release notes (with your permission)
- **Hall of Fame**: Recognition in our project's security contributors section
- **Professional Reference**: LinkedIn recommendations or professional references for your security research skills

We believe in building a collaborative security community and greatly appreciate researchers who help improve our project's security posture.

## 🔐 Security Considerations

This AI-powered changelog generator handles git repository analysis and LLM API integrations. Key security areas include:

### LLM Provider Security

- API keys are stored securely using the built-in configuration store
- All communications with LLM providers use HTTPS/TLS encryption
- API rate limits and request validation prevent abuse
- Proper error handling prevents API key disclosure in logs or outputs

### Git Repository Security

- Local git repository access is read-only for commit analysis
- No modification of git history or repository state
- Repository path validation prevents directory traversal attacks
- Commit message parsing includes input sanitization

### Configuration Security

- Secure config store using the `conf` package for API key storage
- No hardcoded API keys or secrets in source code
- Configuration file permissions are validated where possible
- Secure defaults for all configuration options

### CLI Security

- Input validation for all command-line arguments
- File path validation prevents unauthorized file system access
- Output sanitization prevents injection attacks
- Proper error handling avoids information disclosure

## 🏭 Production Security Checklist

Before using magic-release in production environments:

**Configuration Security:**

- [ ] Use the built-in secure config store for API keys (`magicr --set-api-key`)
- [ ] Set restrictive file permissions on any custom configuration files
- [ ] Enable comprehensive logging and monitoring for automated workflows
- [ ] Validate all input parameters and file paths
- [ ] Keep the tool updated to the latest version

**Environment Security:**

- [ ] Use secure, up-to-date Node.js runtime (20+)
- [ ] Deploy in isolated environments with minimal privileges
- [ ] Implement proper network security controls for CI/CD environments
- [ ] Regular backup of generated changelog outputs
- [ ] Monitor for unusual API usage patterns

**Operational Security:**

- [ ] Regular rotation of API keys and access tokens
- [ ] Audit logs for unauthorized access attempts in automated systems
- [ ] Implement rate limiting for API calls in CI/CD pipelines
- [ ] Set up alerts for failed authentication attempts
- [ ] Regular review of generated changelog content for sensitive data

## 🔍 Security Features

This project implements several security measures:

### Built-in Security

- **Input Validation**: All user inputs and file paths are validated and sanitized
- **Error Handling**: Comprehensive error handling prevents information disclosure
- **Secure Configuration**: Built-in secure storage for API keys using the `conf` package
- **Access Control**: Read-only access to git repositories and file system

### LLM Integration Security

- **Secure API Communication**: All LLM provider APIs accessed via HTTPS
- **API Key Protection**: Secure local storage with no hardcoded credentials
- **Request Validation**: Input sanitization and size limits for all API requests
- **Rate Limiting**: Built-in respect for provider rate limits and quotas

### Code Analysis Security

- **Safe Git Operations**: Read-only git repository analysis
- **Path Validation**: Prevents directory traversal and unauthorized file access
- **Content Filtering**: Automatic filtering of potentially sensitive code patterns
- **Output Sanitization**: Generated changelog content is sanitized before output

## 🆘 Security Support

Your efforts to help us maintain the safety and integrity of this open-source project are greatly appreciated. Thank you for contributing to a more secure development community!

For general security questions or guidance, you can also reach out through:

- Email: [security@warengonzaga.com](mailto:security@warengonzaga.com)
- GitHub Security Advisories (for coordinated disclosure)
- Our [Contributing Guide](./CONTRIBUTING.md) for security development practices

---

🔐 with ❤️ by [Waren Gonzaga](https://warengonzaga.com) under [WG Technology Labs](https://wgtechlabs.com) and [Him](https://www.youtube.com/watch?v=HHrxS4diLew&t=44s) 🙏
