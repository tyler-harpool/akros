# NBA Betting Edge Detection System

This system automatically analyzes NBA betting markets to identify edges and value opportunities. It compares odds across multiple sportsbooks, calculates implied probabilities, and identifies statistically advantageous bets using mathematical models.

## Features

- **Multi-bookmaker odds comparison** across FanDuel, DraftKings, BetMGM, Caesars, PointsBet, and Wynn
- **Edge detection algorithms** that find value based on market inefficiencies
- **Implied probability calculations** that remove the vig from betting lines
- **Closing Line Value (CLV) estimates** to project potential line movements
- **Injury and lineup impact analysis** to contextualize the betting landscape
- **Playoff-specific insights** that account for series dynamics and home court impacts
- **Concrete betting recommendations** with stakes and rationales

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your API keys:
   ```
   ODDS_API_KEY=your_odds_api_key
   CLAUDE_API_KEY=your_claude_api_key!
   ```
4. Run the script:
   ```
   node index.js
   ```

## Automated Analysis

The system runs daily via GitHub Actions. Every morning at 11:00 AM (before NBA games typically start), it:

1. Fetches the latest odds from multiple sportsbooks
2. Analyzes the data for betting edges
3. Generates reports in the `reports/` directory
4. Commits and pushes new bet recommendations to the repository

Results are organized in date-specific folders with:
- Full analysis reports: `nba_edge_analysis_YYYY-MM-DD_HH-MM-SS.md`
- Betting recommendations: `recommended_bets_YYYY-MM-DD_HH-MM-SS.md`

## Setting Up GitHub Secrets

For the GitHub Actions workflow to work, you need to add the following secrets to your repository:

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following repository secrets:
   - `ODDS_API_KEY`: Your API key for The Odds API
   - `CLAUDE_API_KEY`: Your API key for Anthropic's Claude API

## Basketball Betting Strategies

The system implements several key strategies used by professional sports bettors:

1. **Finding mispriced lines** by comparing implied probabilities across bookmakers
2. **Capturing value before line movements** by estimating closing line value
3. **Leveraging playoff dynamics** which create unique betting opportunities
4. **Optimizing player prop analysis** where market inefficiencies are often largest

## Directory Structure

```
├── .github/
│   └── workflows/
│       └── nba-edge-detection.yml
├── reports/
│   └── YYYY-MM-DD/
│       ├── nba_edge_analysis_YYYY-MM-DD_HH-MM-SS.md
│       └── recommended_bets_YYYY-MM-DD_HH-MM-SS.md
├── .env
├── index.js
├── package.json
└── README.md
```

## Notes

- Betting recommendations should be used as one input in your decision-making process
- Always manage bankroll responsibly and avoid chasing losses
- Successful sports betting requires long-term thinking and disciplined approach
- Historical results will be archived in this repository for performance tracking
