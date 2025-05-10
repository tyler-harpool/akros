/**
 * Odds API Functions
 * 
 * This module contains functions for fetching odds data from The Odds API
 * for different sports leagues (NBA, MLB, NHL)
 */

const axios = require('axios');

/**
 * Core function to fetch sports odds from The Odds API
 * @param {string} sportKey - Sport key for The Odds API (e.g., 'basketball_nba')
 * @returns {Promise<Array>} Array of games with odds data
 */
async function getSportsOdds(sportKey) {
  // Using only core supported market types for the basic endpoint
  const marketTypes = ['h2h', 'spreads', 'totals'];
  const regions = 'us';
  const bookmakers = 'fanduel,draftkings,betmgm,caesars,pointsbet,wynn';

  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=${regions}&markets=${marketTypes.join(',')}&oddsFormat=american&apiKey=${process.env.ODDS_API_KEY}&bookmakers=${bookmakers}`;

  try {
    const res = await axios.get(url);
    console.log(`Successfully fetched ${sportKey} odds data for ${res.data.length} games`);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch ${sportKey} odds:`, err.response?.data || err.message);

    // Check for specific error types
    if (err.response && err.response.status === 401) {
      console.error('API key error: Check your ODDS_API_KEY in .env file');
    } else if (err.response && err.response.status === 429) {
      console.error('API rate limit exceeded: You may need to upgrade your API plan');
    }

    return [];
  }
}

/**
 * Fetch NBA odds from The Odds API
 * @returns {Promise<Array>} Array of NBA games with odds data
 */
async function getNbaOdds() {
  return getSportsOdds('basketball_nba');
}

/**
 * Fetch MLB odds from The Odds API
 * @returns {Promise<Array>} Array of MLB games with odds data
 */
async function getMlbOdds() {
  return getSportsOdds('baseball_mlb');
}

/**
 * Fetch NHL odds from The Odds API
 * @returns {Promise<Array>} Array of NHL games with odds data
 */
async function getNhlOdds() {
  return getSportsOdds('icehockey_nhl');
}

module.exports = {
  getSportsOdds,
  getNbaOdds,
  getMlbOdds,
  getNhlOdds
};