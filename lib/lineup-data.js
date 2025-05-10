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

    // Find each game lineup container
    $('.lineup.is-nba').each((i, gameElement) => {
      try {
        // Get teams
        const awayTeam = $(gameElement).find('.lineup__team--away .lineup__team-name').text().trim();
        const homeTeam = $(gameElement).find('.lineup__team--home .lineup__team-name').text().trim();

        // Create matchup key
        const matchupKey = `${awayTeam} @ ${homeTeam}`;

        // Get confirmation and game time
        const gameInfo = $(gameElement).find('.lineup__date').text().trim();
        const isConfirmed = gameInfo.toLowerCase().includes('confirmed');

        // Initialize lineup data for this game
        lineupsByGame[matchupKey] = {
          awayTeam: awayTeam,
          homeTeam: homeTeam,
          isConfirmed: isConfirmed,
          gameInfo: gameInfo,
          awayLineup: [],
          homeLineup: []
        };

        // Get away team lineup
        $(gameElement).find('.lineup__team--away .lineup__player').each((j, playerEl) => {
          const name = $(playerEl).find('.lineup__pos-name').text().trim();
          const position = $(playerEl).find('.lineup__pos').text().trim();

          if (name) {
            lineupsByGame[matchupKey].awayLineup.push({
              name: name,
              position: position,
              isStarter: j < 5
            });
          }
        });

        // Get home team lineup
        $(gameElement).find('.lineup__team--home .lineup__player').each((j, playerEl) => {
          const name = $(playerEl).find('.lineup__pos-name').text().trim();
          const position = $(playerEl).find('.lineup__pos').text().trim();

          if (name) {
            lineupsByGame[matchupKey].homeLineup.push({
              name: name,
              position: position,
              isStarter: j < 5
            });
          }
        });

        console.log(`Found lineup data for: ${matchupKey}`);
      } catch (error) {
        console.error(`Error processing game lineup: ${error.message}`);
      }
    });

    // If we couldn't get lineups from Rotowire, try an alternative source
    if (Object.keys(lineupsByGame).length === 0) {
      console.log('No lineups found on Rotowire, trying alternative source...');

      // Try another source like FantasyPros
      const lineups = await getFantasyProsLineups(games);
      Object.assign(lineupsByGame, lineups);
    }

    // Map The Odds API game formats to our lineup objects
    const mappedLineups = {};
    for (const game of games) {
      const oddsMatchup = `${game.away_team} @ ${game.home_team}`;
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      // Try to find matching lineup
      let lineup = lineupsByGame[oddsMatchup];

      // If no exact match, try fuzzy matching team names
      if (!lineup) {
        const matchKey = findBestMatchingGame(lineupsByGame, homeTeam, awayTeam);
        if (matchKey) {
          lineup = lineupsByGame[matchKey];
        }
      }

      if (lineup) {
        mappedLineups[`${game.away_team} @ ${game.home_team}`] = lineup;
      } else {
        // Create placeholder if we couldn't find lineup data
        mappedLineups[`${game.away_team} @ ${game.home_team}`] = {
          awayTeam: game.away_team,
          homeTeam: game.home_team,
          isConfirmed: false,
          gameInfo: `Game starts at ${new Date(game.commence_time).toLocaleString()}`,
          awayLineup: [],
          homeLineup: [],
          note: "Projected lineup data not available"
        };
      }
    }

    console.log(`Found lineups for ${Object.keys(mappedLineups).filter(k => mappedLineups[k].awayLineup.length > 0).length} out of ${games.length} games`);

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

/**
 * Try to match teams between different naming conventions
 */
function findBestMatchingGame(lineupsByGame, homeTeam, awayTeam) {
  // Common team name variations
  const teamVariations = {
    'Bucks': ['Milwaukee', 'Milwaukee Bucks'],
    'Lakers': ['Los Angeles', 'Los Angeles Lakers', 'LA Lakers'],
    'Clippers': ['Los Angeles', 'Los Angeles Clippers', 'LA Clippers'],
    'Knicks': ['New York', 'New York Knicks'],
    'Nets': ['Brooklyn', 'Brooklyn Nets'],
    'Warriors': ['Golden State', 'Golden State Warriors'],
    'Celtics': ['Boston', 'Boston Celtics'],
    'Bulls': ['Chicago', 'Chicago Bulls'],
    // Add other team variations as needed
  };

  // Try to find best match
  for (const matchup in lineupsByGame) {
    const lineup = lineupsByGame[matchup];

    // Check for direct team name containment
    if ((lineup.homeTeam.includes(homeTeam) || homeTeam.includes(lineup.homeTeam)) &&
        (lineup.awayTeam.includes(awayTeam) || awayTeam.includes(lineup.awayTeam))) {
      return matchup;
    }

    // Check for team name variations
    for (const [shortName, variations] of Object.entries(teamVariations)) {
      if ((homeTeam.includes(shortName) || variations.some(v => homeTeam.includes(v))) &&
          (lineup.homeTeam.includes(shortName) || variations.some(v => lineup.homeTeam.includes(v)))) {
        // Home team matches, check away team
        for (const [awayShortName, awayVariations] of Object.entries(teamVariations)) {
          if ((awayTeam.includes(awayShortName) || awayVariations.some(v => awayTeam.includes(v))) &&
              (lineup.awayTeam.includes(awayShortName) || awayVariations.some(v => lineup.awayTeam.includes(v)))) {
            return matchup;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get lineup data from FantasyPros as fallback
 */
async function getFantasyProsLineups(games) {
  try {
    const url = 'https://www.fantasypros.com/nba/lineups/';

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      }
    });

    const $ = cheerio.load(response.data);
    const lineupsByGame = {};

    // Parse FantasyPros lineup format
    $('.lineup-card').each((i, gameElement) => {
      try {
        const awayTeam = $(gameElement).find('.team-away .team-name').text().trim();
        const homeTeam = $(gameElement).find('.team-home .team-name').text().trim();

        if (!awayTeam || !homeTeam) return;

        const matchupKey = `${awayTeam} @ ${homeTeam}`;

        lineupsByGame[matchupKey] = {
          awayTeam: awayTeam,
          homeTeam: homeTeam,
          isConfirmed: false,
          gameInfo: $(gameElement).find('.game-info').text().trim(),
          awayLineup: [],
          homeLineup: []
        };

        // Away lineup
        $(gameElement).find('.team-away .player').each((j, player) => {
          const playerName = $(player).find('.player-name').text().trim();
          const position = $(player).find('.player-pos').text().trim();

          if (playerName) {
            lineupsByGame[matchupKey].awayLineup.push({
              name: playerName,
              position: position,
              isStarter: j < 5
            });
          }
        });

        // Home lineup
        $(gameElement).find('.team-home .player').each((j, player) => {
          const playerName = $(player).find('.player-name').text().trim();
          const position = $(player).find('.player-pos').text().trim();

          if (playerName) {
            lineupsByGame[matchupKey].homeLineup.push({
              name: playerName,
              position: position,
              isStarter: j < 5
            });
          }
        });

      } catch (error) {
        console.error(`Error processing FantasyPros lineup: ${error.message}`);
      }
    });

    return lineupsByGame;
  } catch (error) {
    console.error('Error fetching FantasyPros lineup data:', error.message);
    return {};
  }
}

module.exports = {
  getLineupData
};
