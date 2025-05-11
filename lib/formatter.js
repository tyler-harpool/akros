// Function to format odds data for Claude's analysis
function formatOddsDataForAnalysis(games) {
  let formattedData = "# Available NBA Betting Lines\n\n";

  // Determine if we're processing live games
  const hasLiveGames = games.some(game => game.isLiveGame);
  const analysisMode = games.length > 0 ? games[0].analysisMode : 'pregame';

  if (hasLiveGames) {
    formattedData += "> **LIVE BETTING ANALYSIS**: Some or all of these games are currently in progress. Odds are being actively updated based on game events.\n\n";
  }

  games.forEach(game => {
    // Add in-progress status if applicable
    const gameStatus = game.isLiveGame ? " (IN PROGRESS)" : "";

    formattedData += `## ${game.home_team} vs ${game.away_team}${gameStatus}\n`;
    formattedData += `Game Start: ${new Date(game.commence_time).toLocaleString()}\n\n`;

    // Add moneyline odds
    formattedData += "### Moneyline Odds\n";
    formattedData += "| Bookmaker | Home Team | Away Team |\n";
    formattedData += "|-----------|-----------|----------|\n";

    game.bookmakers.forEach(bookmaker => {
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      if (h2hMarket) {
        const homeOdds = h2hMarket.outcomes.find(o => o.name === game.home_team)?.price || 'N/A';
        const awayOdds = h2hMarket.outcomes.find(o => o.name === game.away_team)?.price || 'N/A';
        formattedData += `| ${bookmaker.title} | ${homeOdds} | ${awayOdds} |\n`;
      }
    });

    // Add spread odds
    formattedData += "\n### Spread Odds\n";
    formattedData += "| Bookmaker | Home Team | Away Team |\n";
    formattedData += "|-----------|-----------|----------|\n";

    game.bookmakers.forEach(bookmaker => {
      const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
      if (spreadMarket) {
        const homeSpread = spreadMarket.outcomes.find(o => o.name === game.home_team);
        const awaySpread = spreadMarket.outcomes.find(o => o.name === game.away_team);

        const homeDisplay = homeSpread ? `${homeSpread.point} (${homeSpread.price})` : 'N/A';
        const awayDisplay = awaySpread ? `${awaySpread.point} (${awaySpread.price})` : 'N/A';

        formattedData += `| ${bookmaker.title} | ${homeDisplay} | ${awayDisplay} |\n`;
      }
    });

    // Add totals odds
    formattedData += "\n### Totals (Over/Under)\n";
    formattedData += "| Bookmaker | Points | Over | Under |\n";
    formattedData += "|-----------|--------|------|-------|\n";

    game.bookmakers.forEach(bookmaker => {
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      if (totalsMarket) {
        const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
        const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');

        if (overOutcome && underOutcome) {
          formattedData += `| ${bookmaker.title} | ${overOutcome.point} | ${overOutcome.price} | ${underOutcome.price} |\n`;
        }
      }
    });

    formattedData += "\n\n";
  });

  return formattedData;
}

// Function to create a comprehensive prompt for Claude
async function createComprehensivePrompt(games, injuryData, analyzer) {
  // Format the current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Determine if we're processing live games
  const hasLiveGames = games.some(game => game.isLiveGame);
  const analysisMode = games.length > 0 ? games[0].analysisMode : 'pregame';

  // Create an appropriate title based on the mode
  let titlePrefix = "";
  if (analysisMode === 'live') {
    titlePrefix = "LIVE IN-GAME ";
  } else if (analysisMode === 'all') {
    titlePrefix = "COMBINED (PRE-GAME & LIVE) ";
  }

  // Start the prompt
  let prompt = `# ${titlePrefix}NBA Betting Analysis for ${currentDate}\n\n`;

  // Add special instructions for live betting
  if (hasLiveGames) {
    prompt += `## Live Betting Context\n\n`;
    prompt += `Some or all games in this analysis are currently in progress. When analyzing live betting opportunities:\n\n`;
    prompt += `1. Consider the current game state and how it affects odds\n`;
    prompt += `2. Look for overreactions to recent events (scoring runs, injuries, foul trouble)\n`;
    prompt += `3. Pay special attention to momentum shifts that bookmakers might not have fully adjusted for\n`;
    prompt += `4. Be more selective with recommendations, as live markets can be more efficient\n`;
    prompt += `5. Consider game pace and time remaining when evaluating totals\n\n`;
  }

  // Add summary of games being analyzed
  prompt += `## Games Being Analyzed\n\n`;
  games.forEach(game => {
    const gameTime = new Date(game.commence_time).toLocaleString();
    const statusIndicator = game.isLiveGame ? " (IN PROGRESS)" : "";
    prompt += `- ${game.home_team} vs ${game.away_team} (${gameTime})${statusIndicator}\n`;
  });
  prompt += "\n";

  // Add raw odds data
  prompt += formatOddsDataForAnalysis(games);

  // Add edge analysis
  prompt += generateEdgeAnalysis(games, analyzer);

  // Get and add lineup data
  try {
    // Import the lineup module here to avoid circular dependencies
    const { getLineupData } = require('./lineup-data');
    const lineupData = await getLineupData(games);
    prompt += formatLineupData(lineupData);
  } catch (error) {
    console.error("Error adding lineup data:", error.message);
    prompt += "# Current Team Lineups\nLineup data unavailable at this time.\n\n";
  }

  // Add injury information
  if (injuryData && injuryData.injuries && injuryData.injuries.length > 0) {
    prompt += "\n## Key Injuries\n\n";

    // Group injuries by team
    const teamInjuries = {};
    injuryData.injuries.forEach(injury => {
      if (!teamInjuries[injury.team]) {
        teamInjuries[injury.team] = [];
      }
      teamInjuries[injury.team].push(injury);
    });

    // Sort by status severity
    const statusPriority = {
      'Out': 0,
      'Doubtful': 1,
      'Questionable': 2,
      'Probable': 3,
      'Day-To-Day': 4
    };

    // Only include teams that are playing in the games we're analyzing
    const relevantTeams = new Set();
    games.forEach(game => {
      relevantTeams.add(game.home_team);
      relevantTeams.add(game.away_team);
    });

    // Add injury tables for each relevant team
    Object.keys(teamInjuries)
      .filter(team => relevantTeams.has(team))
      .sort()
      .forEach(team => {
        prompt += `### ${team}\n\n`;
        prompt += "| Player | Status | Injury | Expected Return |\n";
        prompt += "|--------|--------|--------|----------------|\n";

        // Sort injuries by status severity then player name
        teamInjuries[team]
          .sort((a, b) => {
            const aPriority = statusPriority[a.status] ?? 999;
            const bPriority = statusPriority[b.status] ?? 999;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return a.player.localeCompare(b.player);
          })
          .forEach(injury => {
            const returnDate = injury.returnDate && injury.returnDate !== 'Unknown'
              ? new Date(injury.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Unknown';

            prompt += `| ${injury.player} | ${injury.status} | ${injury.details} | ${returnDate} |\n`;
          });

        prompt += "\n";
      });
  } else {
    prompt += "\n## Key Injuries\nNo significant injuries reported at this time.\n\n";
  }

  // Add instructions for analysis
  prompt += `\n## Analysis Instructions\n\n`;
  prompt += `Please analyze the provided betting opportunities, focusing on the following:\n\n`;

  // Adjust instructions based on live vs pregame
  if (hasLiveGames) {
    prompt += `1. Evaluate the live betting opportunities, considering current game state\n`;
    prompt += `2. Look for odds that haven't fully adjusted to game flow and momentum shifts\n`;
    prompt += `3. Consider how fatigue and foul trouble may impact the remainder of the game\n`;
    prompt += `4. Focus on total points markets that might not account for pace changes\n`;
    prompt += `5. Be selective and only recommend high-confidence live opportunities\n`;
  } else {
    prompt += `1. Evaluate the statistical edges identified in the analysis\n`;
    prompt += `2. Consider starting lineups and how they might affect each game's dynamics\n`;
    prompt += `3. Factor in how injuries might impact these betting edges\n`;
    prompt += `4. Consider any playoff or tournament dynamics if applicable\n`;
    prompt += `5. Identify which markets (moneyline, spread, totals) show the greatest inefficiencies\n`;
  }

  // Request specific bet recommendations with exact table formatting
  prompt += `\nIMPORTANT: After your analysis, provide exactly 3-5 concrete bet recommendations in a section called "RECOMMENDED BETS". Format these recommendations as a markdown table with these exact columns: Game/Series, Bet Type, Selection, Odds, Stake (1-5 units), and Reasoning. Include REAL ODDS from the data (not placeholders). For each bet, provide a short but clear explanation of why this specific bet has value.`;

  // Add note for live betting
  if (hasLiveGames) {
    prompt += ` For live bets, be sure to note that these are IN-GAME recommendations in the Reasoning column.`;
  }

  return prompt;
}

// Function to generate edge analysis
function generateEdgeAnalysis(games, analyzer) {
  const { detectEdges, estimateClv } = analyzer;
  let analysis = "# Betting Edge Analysis\n\n";

  // Add note about live betting if applicable
  const hasLiveGames = games.some(game => game.isLiveGame);
  if (hasLiveGames) {
    analysis += "> Note: Edge detection for live games may be less reliable due to rapidly changing odds. Use additional caution.\n\n";
  }

  const edges = detectEdges(games);

  if (edges.length === 0) {
    analysis += "No significant edges detected in the current betting markets.\n\n";
    return analysis;
  }

  analysis += `Found ${edges.reduce((total, game) => total + game.edges.length, 0)} potential edges across ${edges.length} games:\n\n`;

  edges.forEach(gameEdge => {
    // Check if this is a live game
    const game = games.find(g => `${g.home_team} vs ${g.away_team}` === gameEdge.game);
    const liveIndicator = game?.isLiveGame ? " (LIVE)" : "";

    analysis += `## ${gameEdge.game}${liveIndicator}\n\n`;

    // Add a table for edges
    analysis += "| Market | Selection | Best Odds | Best Book | Edge | Expected Value | Projected CLV |\n";
    analysis += "|--------|-----------|-----------|-----------|------|----------------|---------------|\n";

    gameEdge.edges.forEach(edge => {
      // Add CLV estimates
      const gameTime = new Date(game.commence_time);
      const hoursTillStart = (gameTime - new Date()) / (1000 * 60 * 60);
      const clv = estimateClv(edge.bestOdds, hoursTillStart);

      let marketDesc = edge.type.toUpperCase();
      let selection = edge.team;
      if (edge.point !== '') {
        selection += ` @ ${edge.point}`;
      }

      analysis += `| ${marketDesc} | ${selection} | ${edge.bestOdds} | ${edge.bestBookmaker} | ${edge.edge} | ${edge.expectedValue} | ${clv.expectedClv} |\n`;
    });

    analysis += "\n";
  });

  return analysis;
}

// Function to format team lineups for analysis
function formatLineupData(lineupData) {
  let formattedData = "# Current Team Lineups\n\n";

  if (!lineupData || Object.keys(lineupData).length === 0) {
    return formattedData + "No lineup data available at this time.\n\n";
  }

  Object.keys(lineupData).forEach(matchup => {
    const lineup = lineupData[matchup];

    formattedData += `## ${matchup}\n`;
    formattedData += `${lineup.gameInfo || ''}\n`;
    formattedData += lineup.isConfirmed ? '**CONFIRMED LINEUP**\n\n' : '*Projected Lineup*\n\n';

    // Away team lineup
    formattedData += `### ${lineup.awayTeam} Lineup\n`;

    if (lineup.awayLineup.length > 0) {
      formattedData += "| Position | Player | Starter |\n";
      formattedData += "|----------|--------|--------|\n";

      lineup.awayLineup.forEach(player => {
        formattedData += `| ${player.position || 'N/A'} | ${player.name} | ${player.isStarter ? '✓' : ''} |\n`;
      });
    } else {
      formattedData += "No lineup data available for this team.\n";
    }

    formattedData += "\n";

    // Home team lineup
    formattedData += `### ${lineup.homeTeam} Lineup\n`;

    if (lineup.homeLineup.length > 0) {
      formattedData += "| Position | Player | Starter |\n";
      formattedData += "|----------|--------|--------|\n";

      lineup.homeLineup.forEach(player => {
        formattedData += `| ${player.position || 'N/A'} | ${player.name} | ${player.isStarter ? '✓' : ''} |\n`;
      });
    } else {
      formattedData += "No lineup data available for this team.\n";
    }

    formattedData += "\n\n";
  });

  return formattedData;
}

module.exports = {
  formatOddsDataForAnalysis,
  generateEdgeAnalysis,
  createComprehensivePrompt,
  formatLineupData
};
