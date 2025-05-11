/**
 * Injury Data Functions
 * 
 * This module contains functions for fetching injury data for different sports leagues
 * (NBA, MLB, NHL) from various sources like ESPN, CBS Sports, etc.
 */

const axios = require('axios');

/**
 * NBA Injury Data Functions
 */

// Function to get NBA injury data from multiple sources
async function getNbaInjuryData() {
  let allInjuries = [];

  // Try ESPN API first
  try {
    // Use our fixed ESPN parser
    const espnInjuries = await getInjuryDataFromEspn('basketball', 'nba');

    if (espnInjuries.length > 0) {
      console.log(`Successfully parsed ${espnInjuries.length} injuries from ESPN`);
      allInjuries = [...espnInjuries];
    } else {
      console.log('No injuries found from ESPN API, trying CBS Sports...');

      // If ESPN fails or returns no data, try CBS Sports
      const cbsInjuries = await getCbsSportsInjuries('nba');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    }
  } catch (err) {
    console.error('Error with ESPN injury data:', err.message);

    // Fall back to CBS Sports if ESPN fails
    try {
      const cbsInjuries = await getCbsSportsInjuries('nba');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    } catch (cbsErr) {
      console.error('Error with CBS Sports injury data:', cbsErr.message);
    }
  }

  // If we still have no injuries, try Rotowire
  if (allInjuries.length === 0) {
    try {
      const rotowireInjuries = await getRotowireInjuries('nba');
      if (rotowireInjuries.length > 0) {
        allInjuries = [...rotowireInjuries];
      }
    } catch (rotowireErr) {
      console.error('Error with Rotowire injury data:', rotowireErr.message);
    }
  }

  // Remove any duplicates (a player might be listed in multiple sources)
  const uniqueInjuries = removeDuplicateInjuries(allInjuries);

  console.log(`Total unique NBA injuries found: ${uniqueInjuries.length}`);
  return { injuries: uniqueInjuries };
}

/**
 * MLB Injury Data Functions
 */

// Function to get MLB injury data from multiple sources
async function getMlbInjuryData() {
  let allInjuries = [];

  // Try ESPN API first
  try {
    const espnInjuries = await getInjuryDataFromEspn('baseball', 'mlb');

    if (espnInjuries.length > 0) {
      console.log(`Successfully parsed ${espnInjuries.length} MLB injuries from ESPN`);
      allInjuries = [...espnInjuries];
    } else {
      console.log('No MLB injuries found from ESPN API, trying CBS Sports...');

      // If ESPN fails or returns no data, try CBS Sports
      const cbsInjuries = await getCbsSportsInjuries('mlb');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    }
  } catch (err) {
    console.error('Error with ESPN MLB injury data:', err.message);

    // Fall back to CBS Sports if ESPN fails
    try {
      const cbsInjuries = await getCbsSportsInjuries('mlb');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    } catch (cbsErr) {
      console.error('Error with CBS Sports MLB injury data:', cbsErr.message);
    }
  }

  // Remove any duplicates (a player might be listed in multiple sources)
  const uniqueInjuries = removeDuplicateInjuries(allInjuries);

  console.log(`Total unique MLB injuries found: ${uniqueInjuries.length}`);
  return { injuries: uniqueInjuries };
}

/**
 * NHL Injury Data Functions
 */

// Function to get NHL injury data from multiple sources
async function getNhlInjuryData() {
  let allInjuries = [];

  // Try ESPN API first
  try {
    const espnInjuries = await getInjuryDataFromEspn('hockey', 'nhl');

    if (espnInjuries.length > 0) {
      console.log(`Successfully parsed ${espnInjuries.length} NHL injuries from ESPN`);
      allInjuries = [...espnInjuries];
    } else {
      console.log('No NHL injuries found from ESPN API, trying CBS Sports...');

      // If ESPN fails or returns no data, try CBS Sports
      const cbsInjuries = await getCbsSportsInjuries('nhl');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    }
  } catch (err) {
    console.error('Error with ESPN NHL injury data:', err.message);

    // Fall back to CBS Sports if ESPN fails
    try {
      const cbsInjuries = await getCbsSportsInjuries('nhl');
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    } catch (cbsErr) {
      console.error('Error with CBS Sports NHL injury data:', cbsErr.message);
    }
  }

  // Remove any duplicates (a player might be listed in multiple sources)
  const uniqueInjuries = removeDuplicateInjuries(allInjuries);

  console.log(`Total unique NHL injuries found: ${uniqueInjuries.length}`);
  return { injuries: uniqueInjuries };
}

/**
 * Shared Helper Functions
 */

// Helper function to remove duplicate injuries
function removeDuplicateInjuries(injuries) {
  const uniqueInjuries = [];
  const seenPlayers = new Set();

  injuries.forEach(injury => {
    const playerKey = `${injury.player}_${injury.team}`.toLowerCase();
    if (!seenPlayers.has(playerKey)) {
      seenPlayers.add(playerKey);
      uniqueInjuries.push(injury);
    }
  });

  // Sort by team name for better organization
  uniqueInjuries.sort((a, b) => a.team.localeCompare(b.team));

  return uniqueInjuries;
}

// Fixed function to properly parse ESPN API injury data for any sport
async function getInjuryDataFromEspn(sport, league) {
  try {
    console.log(`Fetching injury data from ESPN API for ${league.toUpperCase()}...`);

    // ESPN's unofficial API endpoint for injuries
    const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`);

    // Debug the raw response
    console.log(`ESPN API Response structure for ${league.toUpperCase()}:`, JSON.stringify(Object.keys(response.data), null, 2));

    const injuries = [];

    // Process the response differently - looking at the actual structure
    if (response.data) {
      // The injuries appear to be organized by team
      Object.keys(response.data).forEach(key => {
        // Skip non-team properties
        if (key !== 'injuries') return;

        // Each team has a list of player injuries
        const teamInjuries = response.data[key];

        // Iterate through each team
        teamInjuries.forEach(team => {
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
      });
    }

    console.log(`Found ${injuries.length} injuries from ESPN API for ${league.toUpperCase()}`);
    return injuries;
  } catch (err) {
    console.error(`Failed to fetch injury data from ESPN for ${league.toUpperCase()}:`, err.message);
    return [];
  }
}

// Helper function to get injuries from CBS Sports for any sport
async function getCbsSportsInjuries(league) {
  try {
    console.log(`Fetching injury data from CBS Sports for ${league.toUpperCase()}...`);

    // Use axios with proper headers to avoid being blocked
    const response = await axios.get(`https://www.cbssports.com/${league}/injuries/`, {
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
          // Extract data from columns (