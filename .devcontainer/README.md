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
name: NBA Edge Detection

on:
  # Run every day at 11:00 AM (before NBA games typically start)
  schedule:
    - cron: '0 11 * * *'

  # Allow manual trigger
  workflow_dispatch:

jobs:
  analyze-betting-edges:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run edge detection script
        env:
          ODDS_API_KEY: ${{ secrets.ODDS_API_KEY }}
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        run: node index.js

      - name: Commit and push if there are new bet recommendations
        run: |
          # Configure git
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"

          # Check if there are new files to commit
          if [[ -n "$(git status --porcelain)" ]]; then
            git add reports/
            git commit -m "NBA Edge Analysis: $(date '+%Y-%m-%d')"
            git push
          fi
