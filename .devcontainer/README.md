# Development Container for NBA Odds Analysis

This development container provides a consistent environment for working on the NBA Odds Analysis application.

## Features

- Node.js LTS
- Git and other development tools
- VS Code extensions for JavaScript/Node.js development
- Environment variables for API keys
- Automatic npm install when container is created

## Getting Started

1. Make sure you have installed:
   - Docker Desktop
   - VS Code
   - Remote - Containers extension for VS Code

2. Open this folder in VS Code and when prompted to "Reopen in Container", click "Reopen in Container".

   Alternatively, use the command palette (F1) and select "Remote-Containers: Reopen in Container".

3. The container will build and start, and VS Code will connect to it.

4. Your `.env` file with API keys will be available in the container.

## Installed VS Code Extensions

- ESLint for linting
- Prettier for code formatting
- Docker for container management
- NPM IntelliSense for package.json help
- IntelliCode for AI-assisted coding
- GitHub Copilot (if you have a license)
- YAML support for configuration files
- DotENV for .env file highlighting

## Important Notes

- The container mounts your local SSH keys, so you can authenticate with GitHub/GitLab from inside the container.
- Any changes made in the `/workspaces/app` directory will persist on your local machine.
- `nodemon` is installed globally for easy development server restarting.
