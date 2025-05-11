// lib/odds-api.js
const axios = require('axios');
require('dotenv').config();

/**
 * Fetch NBA odds from The Odds API
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of games with odds
 */
async function getNbaOdds(options = {}) {
  const {
    date = new Date().toISOString().split('T')[0],  // Default to today
    regions = 'us',
    marketTypes = ['h2h', 'spreads', 'totals'],
    bookmakers = 'fanduel,draftkings,betmgm,caesars,pointsbet,wynn',
    mode = process.env.BETTING_MODE || 'pregame' // Default to pregame, but use env var if available
  } = options;

  // Determine if we should include live games
  const inPlayParam = mode === 'live' ? true : (mode === 'all' ? undefined : false);
  console.log(`Fetching NBA odds in ${mode} mode (inPlay=${inPlayParam})`);

  // Build the URL with appropriate parameters
  let url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?regions=${regions}&markets=${marketTypes.join(',')}&oddsFormat=american&date=${date}&apiKey=${process.env.ODDS_API_KEY}&bookmakers=${bookmakers}`;

  // Add in-play parameter if specified
  if (inPlayParam !== undefined) {
    url += `&inPlay=${inPlayParam}`;
  }

  try {
    const res = await axios.get(url);

    // Add mode flag to each game for analysis reference
    const gamesWithMode = res.data.map(game => ({
      ...game,
      analysisMode: mode,
      isLiveGame: game.commence_time && new Date(game.commence_time) < new Date()
    }));

    console.log(`Successfully fetched odds data for ${gamesWithMode.length} games on ${date} in ${mode} mode`);

    // Log in-play status for each game
    gamesWithMode.forEach(game => {
      const gameTime = new Date(game.commence_time).toLocaleString();
      const inPlayStatus = game.isLiveGame ? 'IN PROGRESS' : 'UPCOMING';
      console.log(`- ${game.home_team} vs ${game.away_team} (${gameTime}) - Status: ${inPlayStatus}`);
    });

    return gamesWithMode;
  } catch (err) {
    console.error('Failed to fetch NBA odds:', err.response?.data || err.message);
    // Check for specific error types
    if (err.response && err.response.status === 401) {
      console.error('API key error: Check your ODDS_API_KEY in .env file');
    } else if (err.response && err.response.status === 429) {
      console.error('API rate limit exceeded: You may need to upgrade your API plan');
    }
    return [];
  }
}

module.exports = {
  getNbaOdds
};
