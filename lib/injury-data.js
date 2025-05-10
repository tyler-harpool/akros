// lib/injury-data.js
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Get NBA injury data from multiple sources
 */
async function getInjuryData() {
  console.log('Fetching injury data from ESPN API...');

  // Initialize injury collection
  const injuries = [];
  let uniqueInjuries = 0;
  let source = 'None';

  try {
    // Attempt to get injuries from ESPN
    const espnInjuries = await getESPNInjuries();

    if (espnInjuries.length > 0) {
      console.log(`Found ${espnInjuries.length} injuries from ESPN API`);
      injuries.push(...espnInjuries);
      uniqueInjuries = new Set(injuries.map(i => `${i.team}-${i.player}`)).size;
      source = 'ESPN API';
    } else {
      console.log('No injuries found from ESPN API, trying CBS Sports...');

      // Fallback to CBS Sports if ESPN returns no results
      const cbsInjuries = await getCBSSportsInjuries();

      if (cbsInjuries.length > 0) {
        console.log(`Found ${cbsInjuries.length} injuries from CBS Sports`);
        injuries.push(...cbsInjuries);
        uniqueInjuries = new Set(injuries.map(i => `${i.team}-${i.player}`)).size;
        source = 'CBS Sports';
      } else {
        console.log('No injuries found from CBS Sports either');
      }
    }
  } catch (error) {
    console.error('Error fetching injury data:', error.message);
  }

  console.log(`Total unique injuries found: ${uniqueInjuries}`);

  // Return in a structured format
  return {
    lastUpdated: new Date().toISOString(),
    source: source,
    injuries
  };
}

/**
 * Get injuries from ESPN API
 * @returns {Promise<Array>} Array of injury objects
 */
 /**
  * Get injuries from ESPN API with fixed team/player parsing
  * @returns {Promise<Array>} Array of injury objects
  */
 async function getESPNInjuries() {
   try {
     // ESPN API URL
     const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';

     console.log(`Requesting ESPN API: ${url}`);

     const response = await axios.get(url, {
       timeout: 10000,
       headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
         'Accept': 'application/json',
         'Accept-Language': 'en-US,en;q=0.9'
       }
     });

     // Debug response structure
     console.log('ESPN API response keys:', Object.keys(response.data || {}));

     // Check for data structure
     if (!response.data) {
       console.log('ESPN API returned empty data');
       return [];
     }

     // Log sample of raw data for debugging
     console.log('ESPN API raw response sample:',
       JSON.stringify(response.data).substring(0, 200) + '...');

     // Check if the API is returning teams directly
     if (response.data.teams && Array.isArray(response.data.teams)) {
       console.log('ESPN API returned team-based structure');

       // Extract injury data from team structure
       const injuries = [];

       response.data.teams.forEach(team => {
         if (!team || !team.displayName) {
           console.log('Skipping invalid team entry');
           return;
         }

         const teamName = team.displayName;
         console.log(`Processing team: ${teamName}`);

         // Check if this team has player injuries
         if (team.injuries && Array.isArray(team.injuries)) {
           team.injuries.forEach(injury => {
             // Skip if invalid data
             if (!injury || !injury.athlete) {
               return;
             }

             // Extract player name
             const playerName = injury.athlete.displayName || injury.athlete.name || 'Unknown Player';

             // Skip if team name appears in player field
             if (playerName === teamName) {
               console.log(`Skipping invalid player entry: ${playerName}`);
               return;
             }

             const status = injury.status?.type || injury.status?.name || 'Unknown Status';
             const details = injury.injury?.displayName || injury.injury?.name || 'Undisclosed';

             injuries.push({
               player: playerName,
               team: teamName,
               status: status,
               details: details,
               returnDate: injury.returnDate || null,
               lastUpdate: new Date().toISOString()
             });

             console.log(`Added injury: ${playerName} (${teamName}) - ${status}`);
           });
         } else {
           console.log(`No injuries found for team: ${teamName}`);
         }
       });

       console.log(`Processed ${injuries.length} injuries from team structure`);
       return injuries;
     }

     // Handle standard injuries array
     if (response.data.injuries && Array.isArray(response.data.injuries)) {
       console.log('ESPN API returned standard injuries array');

       // Process and normalize ESPN data
       const injuries = response.data.injuries
         .filter(injury => {
           // Make sure we have valid entry
           if (!injury) return false;

           // Check for player vs team issue
           const playerName = injury.athlete?.displayName || injury.athlete?.name || 'Unknown Player';
           const teamName = injury.team?.displayName || 'Unknown Team';

           // Skip if player name equals team name (this indicates API structure issue)
           const isPlayerSameAsTeam = playerName === teamName;
           if (isPlayerSameAsTeam) {
             console.log(`Skipping entry where player name equals team name: ${playerName}`);
           }

           return !isPlayerSameAsTeam && playerName !== 'Unknown Player';
         })
         .map(injury => {
           // Extract team name
           const teamName = injury.team?.displayName || 'Unknown Team';

           // Extract player name
           const playerName = injury.athlete?.displayName || injury.athlete?.name || 'Unknown Player';

           // Extract status
           const status = injury.status?.type || injury.status?.name || 'Unknown Status';

           // Extract injury details
           const details = injury.injury?.displayName || injury.injury?.name || 'Undisclosed';

           return {
             player: playerName,
             team: teamName,
             status: status,
             details: details,
             returnDate: injury.returnDate || null,
             lastUpdate: new Date().toISOString()
           };
         });

       // Log stats
       console.log(`Processed ${injuries.length} injuries from standard structure`);
       if (injuries.length > 0) {
         console.log('Sample injury data:', JSON.stringify(injuries[0], null, 2));
       }

       return injuries;
     }

     // If we get here, we couldn't find injuries in expected formats
     console.log('ESPN API returned unexpected data structure, no injuries found');
     console.log('Raw data sample:', JSON.stringify(response.data).substring(0, 300) + '...');
     return [];

   } catch (error) {
     console.error('Error fetching ESPN injury data:', error.message);
     if (error.response) {
       console.error('ESPN API response status:', error.response.status);
       console.error('ESPN API response headers:', JSON.stringify(error.response.headers, null, 2));
     }
     console.log('ESPN API request failed, will try alternative source');
     return [];
   }
 }

/**
 * Get injuries from CBS Sports website as fallback
 * @returns {Promise<Array>} Array of injury objects
 */
async function getCBSSportsInjuries() {
  try {
    const url = 'https://www.cbssports.com/nba/injuries/';

    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Use cheerio to parse the HTML
    const $ = cheerio.load(response.data);
    const injuries = [];

    // CBS Sports injury table format
    $('.TableBaseWrapper').each((i, tableWrapper) => {
      // Get team name from table header
      const teamName = $(tableWrapper).find('.TeamName').text().trim();

      // Process each row in the table
      $(tableWrapper).find('tbody tr').each((j, row) => {
        const columns = $(row).find('td');

        if (columns.length >= 4) {
          const player = $(columns[0]).text().trim();
          const position = $(columns[1]).text().trim();
          const status = $(columns[2]).text().trim();
          const details = $(columns[3]).text().trim();

          if (player && status) {
            injuries.push({
              player,
              team: teamName,
              position,
              status,
              details,
              returnDate: null, // CBS doesn't provide return dates
              lastUpdate: new Date().toISOString()
            });
          }
        }
      });
    });

    return injuries;
  } catch (error) {
    console.error('Error fetching CBS Sports injury data:', error.message);
    return [];
  }
}

module.exports = {
  getInjuryData
};
