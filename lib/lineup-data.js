// lib/lineup-data.js
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Get projected lineups for NBA games
 * @param {Array} games - Array of game objects from The Odds API
 * @returns {Promise<Object>} - Object with lineups by game
 */
async function getLineupData(games) {
  console.log('Fetching lineup data for NBA games...');

  // Map to store lineups by matchup
  const lineupsByGame = {};

  try {
    // Call Rotowire API for projected lineups
    const baseUrl = 'https://www.rotowire.com/basketball/nba-lineups.php';
    const response = await axios.get(baseUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Debug the HTML structure to understand what we're working with
    console.log('Analyzing Rotowire lineup page structure...');

    // Find each game lineup container
    $('.lineup.is-nba').each((i, gameElement) => {
      try {
        // More robust team name and abbreviation extraction
        // Away team info
        const awayTeamElement = $(gameElement).find('.lineup__mteam.is-visit');
        const awayTeamText = awayTeamElement.text().trim();
        let visitTeam = awayTeamText.split('(')[0].trim();

        // Home team info
        const homeTeamElement = $(gameElement).find('.lineup__mteam.is-home');
        const homeTeamText = homeTeamElement.text().trim();
        let homeTeam = homeTeamText.split('(')[0].trim();

        // Get team abbreviations
        let visitTeamAbbr = $(gameElement).find('.lineup__abbr').eq(0).text().trim();
        let homeTeamAbbr = $(gameElement).find('.lineup__abbr').eq(1).text().trim();

        // Validate team names and abbreviations
        if (!visitTeam || visitTeam === '') {
          console.log(`Warning: Empty away team name found, using fallback`);
          // Fallback to other elements if available
          visitTeam = $(gameElement).find('.lineup__team.is-visit').text().trim() || 'Unknown Away Team';
        }

        if (!homeTeam || homeTeam === '') {
          console.log(`Warning: Empty home team name found, using fallback`);
          // Fallback to other elements if available
          homeTeam = $(gameElement).find('.lineup__team.is-home').text().trim() || 'Unknown Home Team';
        }

        // Double-check abbreviations
        if (!visitTeamAbbr || visitTeamAbbr === '') {
          console.log(`Warning: Empty away team abbreviation, generating from team name`);
          visitTeamAbbr = visitTeam.substring(0, 3).toUpperCase();
        }

        if (!homeTeamAbbr || homeTeamAbbr === '') {
          console.log(`Warning: Empty home team abbreviation, generating from team name`);
          homeTeamAbbr = homeTeam.substring(0, 3).toUpperCase();
        }

        // Skip if both team names are still empty
        if ((visitTeam === 'Unknown Away Team' && homeTeam === 'Unknown Home Team') ||
            (visitTeam === '' && homeTeam === '')) {
          console.log(`Skipping game with invalid team names`);
          return;
        }

        // Create matchup key
        const matchupKey = `${visitTeam} @ ${homeTeam}`;

        // Get game time
        const gameTime = $(gameElement).find('.lineup__time').text().trim() || 'Unknown time';

        // Check if lineups are confirmed
        const isVisitConfirmed = $(gameElement).find('.lineup__status.is-confirmed').eq(0).length > 0;
        const isHomeConfirmed = $(gameElement).find('.lineup__status.is-confirmed').eq(1).length > 0;

        // Initialize lineup data for this game
        lineupsByGame[matchupKey] = {
          awayTeam: visitTeam,
          awayTeamAbbr: visitTeamAbbr,
          homeTeam: homeTeam,
          homeTeamAbbr: homeTeamAbbr,
          isConfirmed: isVisitConfirmed && isHomeConfirmed,
          gameInfo: `Game starts at ${gameTime}`,
          awayLineup: [],
          homeLineup: []
        };

        // Get away team lineup
        $(gameElement).find('.lineup__list.is-visit .lineup__player').each((j, playerEl) => {
          // Extract position and player name
          const posElement = $(playerEl).find('.lineup__pos');
          const position = posElement.text().trim();

          // Get the player name by looking at the link within the element
          const playerLink = $(playerEl).find('a');
          const name = playerLink.text().trim();

          // Check if there's an injury status
          const injuryStatus = $(playerEl).find('.lineup__inj').text().trim();

          if (name) {
            lineupsByGame[matchupKey].awayLineup.push({
              name: name,
              position: position,
              isStarter: j < 5,
              injuryStatus: injuryStatus || null
            });
          }
        });

        // Get home team lineup
        $(gameElement).find('.lineup__list.is-home .lineup__player').each((j, playerEl) => {
          // Extract position and player name
          const posElement = $(playerEl).find('.lineup__pos');
          const position = posElement.text().trim();

          // Get the player name by looking at the link within the element
          const playerLink = $(playerEl).find('a');
          const name = playerLink.text().trim();

          // Check if there's an injury status
          const injuryStatus = $(playerEl).find('.lineup__inj').text().trim();

          if (name) {
            lineupsByGame[matchupKey].homeLineup.push({
              name: name,
              position: position,
              isStarter: j < 5,
              injuryStatus: injuryStatus || null
            });
          }
        });

        console.log(`Found lineup data for: ${matchupKey}`);
      } catch (error) {
        console.error(`Error processing game lineup: ${error.message}`);
      }
    });

    // Map The Odds API game formats to our lineup objects
    const mappedLineups = {};

    // Debug available lineups for troubleshooting
    console.log(`Available lineups from Rotowire:`, Object.keys(lineupsByGame).join(', '));

    // First, normalize team names by removing common suffixes and standardizing format
    const normalizeTeamName = (name) => {
      if (!name) return '';

      // Convert to lowercase and trim
      name = name.toLowerCase().trim();

      // Remove common suffixes
      const suffixes = [' basketball', ' nba', ' nets', ' knicks', ' warriors', ' lakers', ' celtics'];
      for (const suffix of suffixes) {
        if (name.endsWith(suffix)) {
            name = name.substring(0, name.length - suffix.length).trim();
        }
      }

      // City name mappings (common variations)
      const cityMappings = {
        'gsw': 'golden state',
        'gs': 'golden state',
        'la': 'los angeles',
        'ny': 'new york',
        'nyk': 'new york',
        'okc': 'oklahoma city',
        'sas': 'san antonio',
        'phx': 'phoenix',
        'philly': 'philadelphia',
        'sixers': 'philadelphia',
        'cavs': 'cleveland'
      };

      // Apply city name mappings
      for (const [abbr, city] of Object.entries(cityMappings)) {
        if (name === abbr) {
          name = city;
        }
      }

      return name;
    };

    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const oddsMatchup = `${awayTeam} @ ${homeTeam}`;

      // Normalize team names for better matching
      const normalizedHomeTeam = normalizeTeamName(homeTeam);
      const normalizedAwayTeam = normalizeTeamName(awayTeam);

      // Try to find matching lineup - first try exact match
      let lineup = lineupsByGame[oddsMatchup];
      let matchSource = 'exact';

      // If no exact match, try fuzzy matching team names
      if (!lineup) {
        // Try to find a close match based on team names using normalized comparisons
        const potentialMatches = Object.keys(lineupsByGame).map(key => {
          const lineupEntry = lineupsByGame[key];
          const normLineupHome = normalizeTeamName(lineupEntry.homeTeam);
          const normLineupAway = normalizeTeamName(lineupEntry.awayTeam);

          // Calculate a match score (higher is better)
          let score = 0;

          // Home team match scoring
          if (lineupEntry.homeTeam === homeTeam) score += 10;  // Exact match
          else if (normLineupHome === normalizedHomeTeam) score += 8;  // Normalized exact match
          else if (lineupEntry.homeTeamAbbr === homeTeam) score += 7;  // Abbreviation match
          else if (normLineupHome.includes(normalizedHomeTeam)) score += 5;  // Partial match
          else if (normalizedHomeTeam.includes(normLineupHome)) score += 5;  // Partial match

          // Away team match scoring
          if (lineupEntry.awayTeam === awayTeam) score += 10;  // Exact match
          else if (normLineupAway === normalizedAwayTeam) score += 8;  // Normalized exact match
          else if (lineupEntry.awayTeamAbbr === awayTeam) score += 7;  // Abbreviation match
          else if (normLineupAway.includes(normalizedAwayTeam)) score += 5;  // Partial match
          else if (normalizedAwayTeam.includes(normLineupAway)) score += 5;  // Partial match

          return { key, score };
        });

        // Sort by score and take the best match if it's good enough
        potentialMatches.sort((a, b) => b.score - a.score);
        const bestMatch = potentialMatches[0];

        if (bestMatch && bestMatch.score >= 10) {  // Require at least a decent match
          lineup = lineupsByGame[bestMatch.key];
          matchSource = `fuzzy (score: ${bestMatch.score})`;
          console.log(`Fuzzy matched: ${oddsMatchup} to ${bestMatch.key} with score ${bestMatch.score}`);
        }
      }

      if (lineup) {
        mappedLineups[`${awayTeam} @ ${homeTeam}`] = lineup;
      } else {
        // Create placeholder if we couldn't find lineup data
        mappedLineups[`${awayTeam} @ ${homeTeam}`] = {
          awayTeam: awayTeam,
          homeTeam: homeTeam,
          isConfirmed: false,
          gameInfo: `Game starts at ${new Date(game.commence_time).toLocaleString()}`,
          awayLineup: [],
          homeLineup: [],
          note: "Projected lineup data not available"
        };
      }
    }

    // Count how many games have lineup data
    const gamesWithLineups = Object.values(mappedLineups).filter(
      lineup => lineup.awayLineup.length > 0 || lineup.homeLineup.length > 0
    ).length;

    console.log(`Found lineups for ${gamesWithLineups} out of ${games.length} games`);

    return mappedLineups;
  } catch (error) {
    console.error('Error fetching lineup data:', error.message);

    // Return empty lineups on error
    const emptyLineups = {};
    for (const game of games) {
      emptyLineups[`${game.away_team} @ ${game.home_team}`] = {
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        isConfirmed: false,
        gameInfo: `Game starts at ${new Date(game.commence_time).toLocaleString()}`,
        awayLineup: [],
        homeLineup: [],
        note: "Error fetching lineup data"
      };
    }

    return emptyLineups;
  }
}

module.exports = {
  getLineupData
};
