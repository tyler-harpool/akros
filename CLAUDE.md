# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup and Installation
```bash
# Install dependencies
npm install

# Create .env file with required API keys
echo "ODDS_API_KEY=your_odds_api_key" > .env
echo "CLAUDE_API_KEY=your_claude_api_key" >> .env
```

### Running the Application
```bash
# Run with default settings (pregame analysis)
node index.js

# Run in debug mode
node index.js --debug

# Run in live betting mode
node index.js --mode=live

# Run in combined mode (pregame and live)
node index.js --mode=all
```

## System Architecture

The NBA Betting Edge Detection System is designed to analyze betting opportunities across multiple sportsbooks, identify value bets based on statistical analysis, and generate detailed recommendations.

### Core Components

1. **Data Collection**
   - `odds-api.js`: Fetches current odds from multiple sportsbooks via The Odds API
   - `injury-data.js`: Retrieves injury information from ESPN API with CBS Sports as a fallback
   - `lineup-data.js`: Scrapes projected team lineups from Rotowire

2. **Analysis Engine**
   - `analyzer.js`: Contains mathematical functions for calculating implied probabilities, removing vig, and detecting statistical edges
   - `NBABettingAnalyzer.js`: Implements a class that can analyze games and player props with Claude's extended thinking capabilities

3. **Content Formatting and Reporting**
   - `formatter.js`: Formats data for Claude's prompt and generates markdown reports
   - HTML/MD report generation in `index.js`

4. **Automation**
   - GitHub Actions workflow in `.github/workflows/analysis.yaml` runs the analysis at five different times daily:
     - 9 AM UTC (4-5 AM ET): Morning lines
     - 3 PM UTC (10-11 AM ET): Midday updates
     - 10 PM UTC (5-6 PM ET): Pre-game final lines
     - 2 AM UTC (9-10 PM ET): Live in-game betting (East Coast games)
     - 5 AM UTC (12-1 AM ET): Live in-game betting (West Coast games)

### Data Flow

1. The system fetches current NBA odds from multiple sportsbooks (FanDuel, DraftKings, BetMGM, Caesars, PointsBet, and Wynn)
2. Injury data and lineup information are collected from external sources
3. The data is formatted into a comprehensive prompt using the `formatter.js` module
4. This prompt is sent to Claude API with extended thinking enabled (12,000 tokens thinking budget)
5. Claude analyzes the data and generates betting recommendations
6. The system extracts the recommendations and creates formatted reports in markdown and HTML
7. Reports are saved to date-specific folders and copied to the `latest` directory
8. A GitHub Action commits and pushes the reports to the repository

### Directory Structure

- `lib/`: Core modules for data collection and analysis
- `reports/`: Generated reports with betting recommendations
  - `YYYY-MM-DD/`: Date-specific folders for daily reports
  - `latest/`: Always contains the most recent analysis
- `prompts/`: Stores the raw prompts sent to Claude
- `.github/workflows/`: Contains GitHub Actions workflow files

### Configuration

The system supports three operating modes:
- `pregame`: Standard mode for analyzing upcoming games
- `live`: For analyzing in-progress games (different prompt strategy)
- `all`: Combination of both pregame and live analysis

The system requires two API keys:
- `ODDS_API_KEY`: For accessing The Odds API
- `CLAUDE_API_KEY`: For accessing Claude's API with extended thinking

### Implementation Notes

- The `detectEdges` function in `analyzer.js` has a simplified implementation that needs further development
- The `estimateClv` (Closing Line Value) function currently returns placeholder values rather than calculated estimates
- The system formats reports with stylized HTML tables for better readability
- Weekly cleanup jobs automatically remove reports older than 30 days