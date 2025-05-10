const axios = require('axios');
require('dotenv').config();

// Function to fetch NBA odds from The Odds API
async function getNbaOdds(options = {}) {
  const {
    date = new Date().toISOString().split('T')[0],  // Default to today
    regions = 'us',
    marketTypes = ['h2h', 'spreads', 'totals'],
    bookmakers = 'fanduel,draftkings,betmgm,caesars,pointsbet,wynn'
  } = options;

  // Build the URL with date filter if provided
  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?regions=${regions}&markets=${marketTypes.join(',')}&oddsFormat=american&date=${date}&apiKey=${process.env.ODDS_API_KEY}&bookmakers=${bookmakers}`;

  try {
    const res = await axios.get(url);
    console.log(`Successfully fetched odds data for ${res.data.length} games on ${date}`);
    return res.data;
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
