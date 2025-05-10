/**
 * MLB Odds and Analysis Functions
 * 
 * This module fetches MLB odds from The Odds API and provides specialized
 * analysis for baseball betting markets.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { americanToDecimal, decimalToImpliedProbability, americanToImpliedProbability, calculateNoVigProbabilities } = require('./oddsUtils');

// Function to fetch MLB odds from The Odds API
async function getMlbOdds() {
  // Using only core supported market types for the basic endpoint
  const marketTypes = ['h2h', 'spreads', 'totals'];
  const regions = 'us';
  const bookmakers = 'fanduel,draftkings,betmgm,caesars,pointsbet,wynn';

  const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=${regions}&markets=${marketTypes.join(',')}&oddsFormat=american&apiKey=${process.env.ODDS_API_KEY}&bookmakers=${bookmakers}`;

  try {
    const res = await axios.get(url);
    console.log(`Successfully fetched MLB odds data for ${res.data.length} games`);
    return res.data;
  } catch (err) {
    console.error('Failed to fetch MLB odds:', err.response?.data || err.message);

    // Check for specific error types
    if (err.response && err.response.status === 401) {
      console.error('API key error: Check your ODDS_API_KEY in .env file');
    } else if (err.response && err.response.status === 429) {
      console.error('API rate limit exceeded: You may need to upgrade your API plan');
    }

    return [];
  }
}

// Function to fetch MLB injury data
async function getMlbInjuryData() {
  let allInjuries = [];

  // Try ESPN API first for MLB injuries
  try {
    console.log('Fetching MLB injury data from ESPN API...');

    // ESPN's unofficial API endpoint for MLB injuries
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries');

    const injuries = [];

    if (response.data) {
      // Process the response based on ESPN's structure
      if (response.data.injuries && Array.isArray(response.data.injuries)) {
        response.data.injuries.forEach(team => {
          const teamName = team.displayName;

          // Check if the team has injuries array
          if (team.injuries && Array.isArray(team.injuries)) {
            team.injuries.forEach(injury => {
              if (injury && injury.athlete && injury.status) {
                injuries.push({
                  team: teamName,
                  player: injury.athlete.displayName,
                  position: injury.athlete.position?.abbreviation || 'Unknown',
                  status: injury.status,
                  details: injury.details ? (
                    injury.details.type ||
                    injury.details.location ||
                    injury.details.detail ||
                    'Undisclosed'
                  ) : 'Undisclosed',
                  comment: injury.longComment || injury.shortComment || '',
                  returnDate: injury.details && injury.details.returnDate ? injury.details.returnDate : 'Unknown',
                  source: 'ESPN'
                });
              }
            });
          }
        });
      }
    }

    if (injuries.length > 0) {
      console.log(`Found ${injuries.length} MLB injuries from ESPN API`);
      allInjuries = [...injuries];
    } else {
      console.log('No MLB injuries found from ESPN API, trying CBS Sports...');
      
      // If ESPN fails or returns no data, try CBS Sports
      const cbsInjuries = await getCbsSportsMlbInjuries();
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    }
  } catch (err) {
    console.error('Error with ESPN MLB injury data:', err.message);

    // Fall back to CBS Sports if ESPN fails
    try {
      const cbsInjuries = await getCbsSportsMlbInjuries();
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    } catch (cbsErr) {
      console.error('Error with CBS Sports MLB injury data:', cbsErr.message);
    }
  }

  // Remove any duplicates (a player might be listed in multiple sources)
  const uniqueInjuries = [];
  const seenPlayers = new Set();

  allInjuries.forEach(injury => {
    const playerKey = `${injury.player}_${injury.team}`.toLowerCase();
    if (!seenPlayers.has(playerKey)) {
      seenPlayers.add(playerKey);
      uniqueInjuries.push(injury);
    }
  });

  // Sort by team name for better organization
  uniqueInjuries.sort((a, b) => a.team.localeCompare(b.team));

  console.log(`Total unique MLB injuries found: ${uniqueInjuries.length}`);
  return { injuries: uniqueInjuries };
}

// Helper function to get MLB injuries from CBS Sports
async function getCbsSportsMlbInjuries() {
  try {
    console.log('Fetching MLB injury data from CBS Sports...');

    // Use axios with proper headers to avoid being blocked
    const response = await axios.get('https://www.cbssports.com/mlb/injuries/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const injuries = [];
    const html = response.data;

    // Find all tables with injury data
    const tables = html.match(/<table class="TableBase-table">[\s\S]*?<\/table>/g) || [];

    tables.forEach(table => {
      // Get team name from table header
      const teamMatch = table.match(/<th[^>]*>(.*?)<\/th>/);
      const teamName = teamMatch ? teamMatch[1].replace(/<[^>]*>/g, '').trim() : 'Unknown Team';

      // Extract rows of player data
      const rows = table.match(/<tr>[\s\S]*?<\/tr>/g) || [];

      rows.forEach(row => {
        // Skip header rows
        if (row.includes('<th')) return;

        // Extract columns
        const columns = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];

        if (columns.length >= 3) {
          // Extract data from columns (removing HTML tags)
          const playerName = columns[0] ? columns[0].replace(/<[^>]*>/g, '').trim() : 'Unknown';
          const position = columns[1] ? columns[1].replace(/<[^>]*>/g, '').trim() : '';
          const status = columns[2] ? columns[2].replace(/<[^>]*>/g, '').trim() : 'Unknown';

          // Get injury details if available
          let details = 'Undisclosed';
          if (columns.length > 3) {
            details = columns[3] ? columns[3].replace(/<[^>]*>/g, '').trim() : 'Undisclosed';
          }

          // Only add if we have all necessary data
          if (playerName !== 'Unknown' && status !== 'Unknown') {
            injuries.push({
              team: teamName,
              player: playerName,
              position: position,
              status: status,
              details: details,
              source: 'CBS Sports'
            });
          }
        }
      });
    });

    console.log(`Found ${injuries.length} MLB injuries from CBS Sports`);
    return injuries;
  } catch (err) {
    console.error('Failed to fetch MLB injury data from CBS Sports:', err.message);
    return [];
  }
}

// Function to detect MLB-specific edges
function detectMlbEdges(games, edgeThreshold = 0.03, minOdds = -250) {
  const edges = [];

  games.forEach(game => {
    const gameEdges = [];
    const marketTypes = ['h2h', 'spreads', 'totals'];

    marketTypes.forEach(marketType => {
      // For each game, find all bookmakers that offer this market type
      const bookmakers = game.bookmakers.filter(bookie =>
        bookie.markets.some(market => market.key === marketType)
      );

      if (bookmakers.length < 2) return; // Need at least 2 bookmakers to compare

      // Get the market data for each bookmaker
      const marketsData = bookmakers.map(bookie => {
        const market = bookie.markets.find(m => m.key === marketType);
        return {
          bookmaker: bookie.key,
          market: market ? market : null
        };
      }).filter(data => data.market !== null);

      // For each outcome in this market (e.g., each team for h2h)
      const allOutcomes = new Set();
      marketsData.forEach(data => {
        data.market.outcomes.forEach(outcome => {
          allOutcomes.add(outcome.name);
        });
      });

      allOutcomes.forEach(outcomeName => {
        // Find the best odds for this outcome across all bookmakers
        let bestOdds = -Infinity;
        let bestBookmaker = '';

        marketsData.forEach(data => {
          const outcome = data.market.outcomes.find(o => o.name === outcomeName);
          if (outcome && outcome.price > bestOdds) {
            bestOdds = outcome.price;
            bestBookmaker = data.bookmaker;
          }
        });

        // Skip if best odds don't meet minimum threshold
        if (bestOdds < minOdds) return;

        // Calculate average market probability (excluding best odds)
        const otherBookies = marketsData.filter(data => data.bookmaker !== bestBookmaker);
        if (otherBookies.length === 0) return;

        const otherOutcomes = otherBookies.map(data => {
          const outcome = data.market.outcomes.find(o => o.name === outcomeName);
          return outcome ? outcome : null;
        }).filter(o => o !== null);

        if (otherOutcomes.length === 0) return;

        // Calculate implied probabilities
        const bestImpliedProb = americanToImpliedProbability(bestOdds);

        const otherImpliedProbs = otherOutcomes.map(outcome =>
          americanToImpliedProbability(outcome.price)
        );

        const avgMarketProb = otherImpliedProbs.reduce((sum, prob) => sum + prob, 0) / otherImpliedProbs.length;

        // Calculate edge
        const edge = avgMarketProb - bestImpliedProb;

        // If edge exceeds threshold, record it
        if (edge > edgeThreshold) {
          let