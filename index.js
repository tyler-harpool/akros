require('dotenv').config();
const axios = require('axios');

// CORE FUNCTIONS FOR ODDS FETCHING AND ANALYSIS

// Function to fetch NBA odds from The Odds API
async function getNbaOdds() {
  // Using only core supported market types for the basic endpoint
  const marketTypes = ['h2h', 'spreads', 'totals'];
  const regions = 'us';
  const bookmakers = 'fanduel,draftkings,betmgm,caesars,pointsbet,wynn';

  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?regions=${regions}&markets=${marketTypes.join(',')}&oddsFormat=american&apiKey=${process.env.ODDS_API_KEY}&bookmakers=${bookmakers}`;

  try {
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error('Failed to fetch NBA odds:', err.response?.data || err.message);
    return [];
  }
}

// Ask Claude to analyze the betting opportunities
async function askClaude(prompt) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2048,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.content[0].text;
  } catch (err) {
    console.error('Failed to query Claude:', err.response?.data || err.message);
    return '';
  }
}

// Mock function to get injury data - would connect to a real API in production
async function getInjuryData() {
  // In a real scenario, you'd fetch this from an API
  // For now, returning mock data based on current playoffs
  return {
    injuries: [
      { team: "Indiana Pacers", player: "Tyrese Haliburton", status: "Questionable", details: "Hamstring" },
      { team: "Golden State Warriors", player: "Stephen Curry", status: "Probable", details: "Ankle" },
      { team: "Denver Nuggets", player: "Jamal Murray", status: "Day-to-Day", details: "Calf" }
    ]
  };
}

// PROBABILITY AND ODDS CONVERSION FUNCTIONS

// Convert American odds to decimal format
function americanToDecimal(americanOdds) {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

// Convert decimal odds to implied probability
function decimalToImpliedProbability(decimalOdds) {
  return 1 / decimalOdds;
}

// Convert American odds directly to implied probability
function americanToImpliedProbability(americanOdds) {
  const decimal = americanToDecimal(americanOdds);
  return decimalToImpliedProbability(decimal);
}

// Calculate no-vig fair probabilities from a set of outcomes
function calculateNoVigProbabilities(outcomes) {
  const impliedProbabilities = outcomes.map(outcome =>
    americanToImpliedProbability(outcome.price)
  );

  // Calculate overround (sum of probabilities)
  const overround = impliedProbabilities.reduce((sum, prob) => sum + prob, 0);

  // Normalize to remove the vig
  return impliedProbabilities.map(prob => prob / overround);
}

// EDGE DETECTION ALGORITHMS

// Core function to detect edges across all bookmakers
function detectEdges(games, edgeThreshold = 0.05, minOdds = -200) {
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
          let point = '';
          if (marketType === 'spreads' || marketType === 'totals') {
            const outcome = marketsData.find(data => data.bookmaker === bestBookmaker)
              .market.outcomes.find(o => o.name === outcomeName);
            point = outcome.point;
          }

          gameEdges.push({
            type: marketType,
            team: outcomeName,
            point: point,
            bestOdds: bestOdds,
            bestBookmaker: bestBookmaker,
            impliedProbability: bestImpliedProb.toFixed(4),
            marketProbability: avgMarketProb.toFixed(4),
            edge: (edge * 100).toFixed(2) + '%',
            expectedValue: ((avgMarketProb / bestImpliedProb) - 1).toFixed(4)
          });
        }
      });
    });

    if (gameEdges.length > 0) {
      edges.push({
        game: `${game.home_team} vs ${game.away_team}`,
        edges: gameEdges
      });
    }
  });

  return edges;
}

// CLOSING LINE VALUE ESTIMATION

// Simple model to estimate closing line value
function estimateClv(currentOdds, hoursTillStart) {
  // This is a simplified model - in reality, you'd need historical data
  const isFavorite = currentOdds < 0;
  let expectedLineMovement = 0;

  if (hoursTillStart > 12) {
    // Far from game time, more potential movement
    expectedLineMovement = isFavorite ? 0.05 : 0.03;
  } else if (hoursTillStart > 4) {
    // Getting closer
    expectedLineMovement = isFavorite ? 0.03 : 0.02;
  } else {
    // Close to game time
    expectedLineMovement = isFavorite ? 0.01 : 0.01;
  }

  // Estimate CLV
  const currentImpliedProb = americanToImpliedProbability(currentOdds);
  const projectedImpliedProb = isFavorite
    ? currentImpliedProb + expectedLineMovement
    : currentImpliedProb - expectedLineMovement;

  return {
    currentOdds,
    currentImpliedProb: currentImpliedProb.toFixed(4),
    projectedImpliedProb: projectedImpliedProb.toFixed(4),
    expectedClv: (expectedLineMovement * 100).toFixed(2) + '%'
  };
}

// ANALYSIS AND REPORTING FUNCTIONS

// Format the edge analysis for Claude
function analyzeEdges(games) {
  const edges = detectEdges(games);

  // Add CLV estimates
  edges.forEach(gameEdge => {
    const gameTime = new Date(games.find(g =>
      `${g.home_team} vs ${g.away_team}` === gameEdge.game
    ).commence_time);

    const hoursTillStart = (gameTime - new Date()) / (1000 * 60 * 60);

    gameEdge.edges.forEach(edge => {
      edge.clv = estimateClv(edge.bestOdds, hoursTillStart);
    });
  });

  // Format for Claude
  let formatted = "# NBA Betting Edge Analysis\n\n";

  if (edges.length === 0) {
    formatted += "No significant edges detected in today's NBA markets.\n";
  } else {
    formatted += `Found ${edges.reduce((total, game) => total + game.edges.length, 0)} potential edges across ${edges.length} games:\n\n`;

    // Add table of all available games and odds
    formatted += "## Available Games and Odds\n\n";
    formatted += "| Game | Moneyline Home | Moneyline Away | Spread | Total |\n";
    formatted += "|------|---------------|---------------|--------|-------|\n";

    games.forEach(game => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      let moneylineHome = "N/A";
      let moneylineAway = "N/A";
      let spread = "N/A";
      let total = "N/A";

      // Get best available odds for each market
      if (game.bookmakers && game.bookmakers.length > 0) {
        // Find moneyline
        const h2hMarket = game.bookmakers.find(bookie =>
          bookie.markets.some(m => m.key === 'h2h')
        )?.markets.find(m => m.key === 'h2h');

        if (h2hMarket) {
          const homeOdds = h2hMarket.outcomes.find(o => o.name === homeTeam)?.price;
          const awayOdds = h2hMarket.outcomes.find(o => o.name === awayTeam)?.price;
          moneylineHome = homeOdds !== undefined ? homeOdds : "N/A";
          moneylineAway = awayOdds !== undefined ? awayOdds : "N/A";
        }

        // Find spread
        const spreadMarket = game.bookmakers.find(bookie =>
          bookie.markets.some(m => m.key === 'spreads')
        )?.markets.find(m => m.key === 'spreads');

        if (spreadMarket) {
          const homeSpread = spreadMarket.outcomes.find(o => o.name === homeTeam);
          if (homeSpread) {
            spread = `${homeTeam} ${homeSpread.point} (${homeSpread.price})`;
          }
        }

        // Find total
        const totalMarket = game.bookmakers.find(bookie =>
          bookie.markets.some(m => m.key === 'totals')
        )?.markets.find(m => m.key === 'totals');

        if (totalMarket && totalMarket.outcomes.length > 0) {
          const overOutcome = totalMarket.outcomes.find(o => o.name === 'Over');
          if (overOutcome) {
            total = `O/U ${overOutcome.point} (${overOutcome.price})`;
          }
        }
      }

      formatted += `| ${homeTeam} vs ${awayTeam} | ${moneylineHome} | ${moneylineAway} | ${spread} | ${total} |\n`;
    });

    formatted += "\n## Detected Edges\n\n";

    edges.forEach(gameEdge => {
      formatted += `### ${gameEdge.game}\n\n`;

      // Table format for edges
      formatted += "| Market | Selection | Best Odds | Best Book | Edge | Expected Value | Projected CLV |\n";
      formatted += "|--------|-----------|-----------|-----------|------|----------------|---------------|\n";

      gameEdge.edges.forEach(edge => {
        let marketDesc = edge.type.toUpperCase();
        let selection = edge.team;
        if (edge.point !== '') {
          selection += ` @ ${edge.point}`;
        }

        formatted += `| ${marketDesc} | ${selection} | ${edge.bestOdds} | ${edge.bestBookmaker} | ${edge.edge} | ${edge.expectedValue} | ${edge.clv.expectedClv} |\n`;
      });

      formatted += "\n";
    });

    formatted += "## Recommendation\n\n";
    formatted += "Consider bets with the highest combination of edge percentage and expected value. ";
    formatted += "Positive expected CLV suggests the line may move in your favor.\n\n";
    formatted += "Remember to check for recent injury news and lineup changes before placing any bets.";
  }

  return formatted;
}

// Add playoff-specific analysis
async function analyzePlayoffSpecifics() {
  let playoffInsights = "## Playoff-Specific Insights\n\n";

  // Home court advantage tends to be more significant in playoffs
  playoffInsights += "### Home Court Analysis\n";
  playoffInsights += "Home teams in NBA playoffs historically cover at a higher rate than regular season games.\n";

  // Series pricing can offer value compared to individual games
  playoffInsights += "\n### Series Pricing Opportunities\n";
  playoffInsights += "When analyzing game odds, compare with the series pricing to find arbitrage opportunities.\n";

  // Pace tends to slow down in playoffs
  playoffInsights += "\n### Pace Considerations\n";
  playoffInsights += "Playoff basketball typically slows down compared to regular season. Consider this when analyzing totals.\n";

  return playoffInsights;
}

// Add player props analysis
async function analyzePlayerProps() {
  let propsAnalysis = "## Player Props Analysis\n\n";

  propsAnalysis += "Player props often present the biggest market inefficiencies. ";
  propsAnalysis += "Consider these factors when analyzing player props:\n\n";
  propsAnalysis += "1. **Minutes projection** - The foundation of all player prop analysis\n";
  propsAnalysis += "2. **Matchup specifics** - Defensive ratings against the specific stat category\n";
  propsAnalysis += "3. **Recent role changes** - Lineup adjustments in playoff series\n";
  propsAnalysis += "4. **Pace impact** - How game tempo affects counting stats\n";

  return propsAnalysis;
}

// Main analysis function
async function analyzeBettingOpportunities() {
  // Get odds data
  const oddsData = await getNbaOdds();
  if (!oddsData.length) {
    console.error('No data available from The Odds API.');
    return 'No data available for analysis.';
  }

  // Get injury data
  const injuryData = await getInjuryData();

  // Detect edges
  const edgeAnalysis = analyzeEdges(oddsData);

  // Create complete analysis for Claude
  let completeAnalysis = edgeAnalysis;

  if (injuryData.injuries.length > 0) {
    completeAnalysis += "\n\n## Key Injuries & Lineup Changes\n\n";
    injuryData.injuries.forEach(injury => {
      completeAnalysis += `- ${injury.team}: ${injury.player} (${injury.status}) - ${injury.details}\n`;
    });
  }

  // Add playoff context if we're in the playoffs
  const currentDate = new Date();
  const isPlayoffSeason = currentDate.getMonth() >= 3 && currentDate.getMonth() <= 5; // April-June

  if (isPlayoffSeason) {
    completeAnalysis += "\n\n## Playoff Context\n\n";

    // Add current playoff matchups and series standings
    completeAnalysis += "Current playoff matchups:\n";
    completeAnalysis += "- Eastern Conference: Cavaliers vs. Pacers (Pacers lead 2-1), Celtics vs. Knicks (Knicks lead 2-0)\n";
    completeAnalysis += "- Western Conference: Thunder vs. Nuggets (Series tied 1-1), Timberwolves vs. Warriors (Series tied 1-1)\n\n";

    // Add specific playoff betting considerations
    completeAnalysis += "Playoff betting differs from regular season in several key aspects:\n";
    completeAnalysis += "1. Teams often have more detailed gameplans for specific opponents\n";
    completeAnalysis += "2. Minutes distributions become more predictable as rotations tighten\n";
    completeAnalysis += "3. Adjustments between games can create significant edges\n";
    completeAnalysis += "4. Public perception can heavily influence lines after notable performances\n";
  }

  completeAnalysis += "\n\nPlease analyze these betting opportunities, focusing on the statistical edges. ";

  if (injuryData.injuries.length > 0) {
    completeAnalysis += "Consider how these injuries might impact the identified betting edges. ";
  }

  if (isPlayoffSeason) {
    completeAnalysis += "Factor in the playoff context and how series dynamics might influence upcoming games. ";
  }

  completeAnalysis += "Identify which markets (moneyline, spread, totals, player props) currently show the greatest inefficiencies based on the data. ";

  // Request specific bet recommendations with exact table formatting
  completeAnalysis += "IMPORTANT: After your analysis, provide exactly 3-5 concrete bet recommendations in a section called \"RECOMMENDED BETS\". Format these recommendations as a markdown table with these columns: Game/Series, Bet Type, Selection, Odds, Stake (1-5 units), and Reasoning. Include REAL ODDS from the data (not XXX placeholders). For each bet, provide a short but clear explanation of why this specific bet has value. Make sure to consider current injuries and playoff dynamics in your selections.";

  // Send to Claude for analysis
  const claudeAnalysis = await askClaude(completeAnalysis);
  return claudeAnalysis;
}

// MAIN EXECUTION
(async () => {
  console.log('🔍 Analyzing NBA betting opportunities...');

  // Check if we're in playoff season
  const currentDate = new Date();
  const isPlayoffSeason = currentDate.getMonth() >= 3 && currentDate.getMonth() <= 5; // April-June

  try {
    const analysis = await analyzeBettingOpportunities();

    // Add playoff-specific analysis if we're in playoff season
    let completeAnalysis = analysis;
    if (isPlayoffSeason) {
      const playoffInsights = await analyzePlayoffSpecifics();
      const propsAnalysis = await analyzePlayerProps();

      // Only add these sections if we actually got analysis back
      if (analysis !== 'No data available for analysis.') {
        completeAnalysis = analysis + "\n\n" + playoffInsights + "\n\n" + propsAnalysis;
      }
    }

    // Format date for file naming
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const dateTimeStr = `${dateStr}_${timeStr}`;

    // Create reports directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const reportsDir = path.join(__dirname, 'reports');
    const dateDir = path.join(reportsDir, dateStr);

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir);
    }

    // Save complete analysis as markdown
    const fullReportPath = path.join(dateDir, `nba_edge_analysis_${dateTimeStr}.md`);
    fs.writeFileSync(fullReportPath, completeAnalysis);
    console.log(`\n📝 Full analysis saved to ${fullReportPath}`);

    // Extract and save just the recommended bets section
    if (completeAnalysis.includes('RECOMMENDED BETS')) {
      console.log('\n🎯 RECOMMENDED BETS FOUND');

      // Extract the table section from RECOMMENDED BETS to the next header or end
      let betSection = completeAnalysis.split('RECOMMENDED BETS')[1];
      const endMarkers = ['##', '\n\n\n', '\n---'];
      let endPos = betSection.length;

      for (const marker of endMarkers) {
        const pos = betSection.indexOf(marker);
        if (pos !== -1 && pos < endPos) {
          endPos = pos;
        }
      }

      betSection = betSection.substring(0, endPos).trim();

      // Create a pretty markdown document with bets
      const todayStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const betsMd = `# NBA Betting Recommendations
## ${todayStr}

## RECOMMENDED BETS
${betSection}

---
*Generated by NBA Edge Detection System on ${dateStr} at ${timeStr.replace(/-/g, ':')}*
`;

      const betsPath = path.join(dateDir, `recommended_bets_${dateTimeStr}.md`);
      fs.writeFileSync(betsPath, betsMd);
      console.log(`📊 Recommended bets saved to ${betsPath}`);

      // Also create an HTML version for better table viewing
      const marked = require('marked');
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NBA Betting Recommendations - ${dateStr}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3 {
      color: #222;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    tr:hover {
      background-color: #f1f1f1;
    }
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #777;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }
    .unit-1 { background-color: #f0f8ff; }
    .unit-2 { background-color: #e6f2ff; }
    .unit-3 { background-color: #cce5ff; }
    .unit-4 { background-color: #b3d7ff; }
    .unit-5 { background-color: #99c9ff; }
  </style>
</head>
<body>
  ${marked.parse(betsMd)}
  <script>
    // Highlight rows based on unit size
    document.addEventListener('DOMContentLoaded', function() {
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 5) {
            const stakeCell = cells[4]; // The stake column (assuming it's the 5th column)
            const stakeText = stakeCell.textContent.trim();
            const units = parseInt(stakeText.match(/\\d+/));
            if (!isNaN(units) && units >= 1 && units <= 5) {
              row.classList.add('unit-' + units);
            }
          }
        });
      });
    });
  </script>
</body>
</html>`;

      const htmlPath = path.join(dateDir, `recommended_bets_${dateTimeStr}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`🌐 HTML version saved to ${htmlPath}`);

      // Display the bets in the console
      console.log('\n' + betsMd);
    } else {
      console.log('\n⚠️ No recommended bets found in analysis');
    }
  } catch (error) {
    console.error('An error occurred during analysis:', error);
  }
})();
