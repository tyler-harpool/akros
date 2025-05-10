require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const { Anthropic } = require('@anthropic-ai/sdk');

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

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
    console.log(`Successfully fetched odds data for ${res.data.length} games`);
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

// Enhanced askClaude function with extended thinking capabilities
async function askClaude(prompt, options = {}) {
  const {
    thinkingBudget = 12000,
    maxTokens = 16000,  // Increased to be larger than thinkingBudget
    temperature = 1,
    model = 'claude-3-7-sonnet-20250219',
    includeThinking = true
  } = options;

  try {
    console.log('Querying Claude with extended thinking...');

    // Create API parameters with extended thinking enabled
    const apiParams = {
      model: model,
      max_tokens: maxTokens,
      temperature: 1,  // Must be exactly 1 when using extended thinking
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingBudget
      },
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    // Add system prompt if provided
    if (options.systemPrompt) {
      apiParams.system = options.systemPrompt;
    }

    // Make the API request
    const response = await anthropic.messages.create(apiParams);

    // Process the response to extract thinking blocks and final text
    const processedResponse = {
      // Extract thinking content (excluding redacted blocks)
      thinking: response.content
        .filter(block => block.type === 'thinking')
        .map(block => block.thinking)
        .join('\n\n'),

      // Track if any redacted blocks exist
      hasRedactedThinking: response.content.some(
        block => block.type === 'redacted_thinking'
      ),

      // Store redacted blocks (needed for multi-turn conversations)
      redactedBlocks: response.content.filter(
        block => block.type === 'redacted_thinking'
      ),

      // Extract final response text
      finalResponse: response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(''),

      // Store the full response for conversation continuity
      fullResponse: response
    };

    // Return the complete processed response or just the final response text
    return includeThinking ? processedResponse : processedResponse.finalResponse;
  } catch (err) {
    console.error('Failed to query Claude:', err.response?.data || err.message);
    console.error('Error details:', JSON.stringify(err.response?.data || err, null, 2));

    // If extended thinking fails, attempt to fallback to standard mode
    if (err.message.includes('thinking') || err.message.includes('budget')) {
      console.log('Falling back to standard mode without extended thinking...');
      return askClaudeStandard(prompt, options);
    }

    return 'Error communicating with Claude. Please check API key and connection.';
  }
}

// Standard Claude function as fallback
async function askClaudeStandard(prompt, options = {}) {
  try {
    const {
      maxTokens = 4096,
      temperature = 0.5,
      model = 'claude-3-7-sonnet-20250219'
    } = options;

    // Create API parameters without extended thinking
    const apiParams = {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    // Add system prompt if provided
    if (options.systemPrompt) {
      apiParams.system = options.systemPrompt;
    }

    const response = await anthropic.messages.create(apiParams);

    return response.content[0].text;
  } catch (error) {
    console.error('Error in standard Claude mode:', error);
    return 'Error communicating with Claude in standard mode. Please check your API key and connection.';
  }
}

// Continue a conversation with preserved thinking context
async function continueConversationWithThinking(conversation, newUserMessage, options = {}) {
  try {
    const {
      thinkingBudget = 12000,
      maxTokens = 16000, // Increased to be larger than thinkingBudget
      temperature = 1,
      model = 'claude-3-7-sonnet-20250219'
    } = options;

    // Format the conversation history for the API
    const messages = [];

    for (const msg of conversation) {
      if (msg.role === 'user') {
        messages.push({
          role: 'user',
          content: msg.content
        });
      } else if (msg.role === 'assistant') {
        // Include the complete content array from the previous response
        // This ensures thinking and redacted_thinking blocks are preserved
        messages.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: newUserMessage
    });

          const apiParams = {
      model: model,
      max_tokens: maxTokens,
      temperature: 1,  // Must be exactly 1 when using extended thinking
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingBudget
      },
      messages: messages
    };

    // Add system prompt if provided
    if (options.systemPrompt) {
      apiParams.system = options.systemPrompt;
    }

    const response = await anthropic.messages.create(apiParams);

    // Process and return the response
    const processedResponse = {
      thinking: response.content
        .filter(block => block.type === 'thinking')
        .map(block => block.thinking)
        .join('\n\n'),
      hasRedactedThinking: response.content.some(
        block => block.type === 'redacted_thinking'
      ),
      redactedBlocks: response.content.filter(
        block => block.type === 'redacted_thinking'
      ),
      finalResponse: response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(''),
      fullResponse: response
    };

    return processedResponse;
  } catch (error) {
    console.error('Error continuing conversation with thinking:', error);
    // Fallback to standard mode
    return askClaudeStandard(newUserMessage, options);
  }
}

// Function to get injury data from ESPN (most reliable public source)
async function getInjuryData() {
  let allInjuries = [];

  // Try ESPN API first
  try {
    // Use our fixed ESPN parser
    const espnInjuries = await getInjuryDataFromEspn();

    if (espnInjuries.length > 0) {
      console.log(`Successfully parsed ${espnInjuries.length} injuries from ESPN`);
      allInjuries = [...espnInjuries];
    } else {
      console.log('No injuries found from ESPN API, trying CBS Sports...');

      // If ESPN fails or returns no data, try CBS Sports
      const cbsInjuries = await getCbsSportsInjuries();
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    }
  } catch (err) {
    console.error('Error with ESPN injury data:', err.message);

    // Fall back to CBS Sports if ESPN fails
    try {
      const cbsInjuries = await getCbsSportsInjuries();
      if (cbsInjuries.length > 0) {
        allInjuries = [...cbsInjuries];
      }
    } catch (cbsErr) {
      console.error('Error with CBS Sports injury data:', cbsErr.message);
    }
  }

  // If we still have no injuries, try a third source (Rotowire)
  if (allInjuries.length === 0) {
    try {
      const rotowireInjuries = await getRotowireInjuries();
      if (rotowireInjuries.length > 0) {
        allInjuries = [...rotowireInjuries];
      }
    } catch (rotowireErr) {
      console.error('Error with Rotowire injury data:', rotowireErr.message);
    }
  }

  // Add a direct entry for Steph Curry based on the data you shared
  // This is a fallback to ensure this critical information is included
  const stephCurryFound = allInjuries.some(injury =>
    injury.player === 'Stephen Curry' && injury.team === 'Golden State Warriors'
  );

  if (!stephCurryFound) {
    allInjuries.push({
      team: 'Golden State Warriors',
      player: 'Stephen Curry',
      status: 'Out',
      details: 'Hamstring (Grade 1 left hamstring strain)',
      comment: 'The Warriors announced Wednesday that Curry will be re-evaluated in one week. An MRI taken on Curry confirmed a Grade 1 left hamstring strain.',
      returnDate: '2025-05-14',
      source: 'Manual Entry (Based on API data)'
    });
    console.log('Added Steph Curry injury manually based on provided data');
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

  console.log(`Total unique injuries found: ${uniqueInjuries.length}`);
  return { injuries: uniqueInjuries };
}

// Fixed function to properly parse ESPN API injury data
async function getInjuryDataFromEspn() {
  try {
    console.log('Fetching injury data from ESPN API...');

    // ESPN's unofficial API endpoint for NBA injuries
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries');

    // Debug the raw response
    console.log('ESPN API Response structure:', JSON.stringify(Object.keys(response.data), null, 2));

    const injuries = [];

    // Process the response differently - looking at the actual structure
    // In the sample data we can see the structure is different than what we expected
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

    console.log(`Found ${injuries.length} injuries from ESPN API`);
    return injuries;
  } catch (err) {
    console.error('Failed to fetch injury data from ESPN:', err.message);
    return [];
  }
}

// Helper function to get injuries from CBS Sports
async function getCbsSportsInjuries() {
  try {
    console.log('Fetching injury data from CBS Sports...');

    // Use axios with proper headers to avoid being blocked
    const response = await axios.get('https://www.cbssports.com/nba/injuries/', {
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
              status: status,
              details: details,
              source: 'CBS Sports'
            });
          }
        }
      });
    });

    console.log(`Found ${injuries.length} injuries from CBS Sports`);
    return injuries;
  } catch (err) {
    console.error('Failed to fetch injury data from CBS Sports:', err.message);
    return [];
  }
}

// Helper function to get injuries from Rotowire
async function getRotowireInjuries() {
  try {
    console.log('Fetching injury data from Rotowire...');

    // Rotowire often has comprehensive injury data
    const response = await axios.get('https://www.rotowire.com/basketball/injury-report.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const injuries = [];
    const html = response.data;

    // Find injury rows
    const injuryRows = html.match(/<tr class="row[^"]*">[\s\S]*?<\/tr>/g) || [];

    injuryRows.forEach(row => {
      // Extract player, team, position, injury and status
      const playerMatch = row.match(/<a[^>]*>([^<]+)<\/a>/);
      const teamMatch = row.match(/<td[^>]*data-label="Team"[^>]*>(.*?)<\/td>/);
      const injuryMatch = row.match(/<td[^>]*data-label="Injury"[^>]*>(.*?)<\/td>/);
      const statusMatch = row.match(/<td[^>]*data-label="Status"[^>]*>(.*?)<\/td>/);

      if (playerMatch && teamMatch && statusMatch) {
        const player = playerMatch[1].trim();
        const team = teamMatch[1].replace(/<[^>]*>/g, '').trim();
        const status = statusMatch[1].replace(/<[^>]*>/g, '').trim();
        const details = injuryMatch ? injuryMatch[1].replace(/<[^>]*>/g, '').trim() : 'Undisclosed';

        injuries.push({
          team: team,
          player: player,
          status: status,
          details: details,
          source: 'Rotowire'
        });
      }
    });

    console.log(`Found ${injuryRows.length} injuries from Rotowire`);
    return injuries;
  } catch (err) {
    console.error('Failed to fetch injury data from Rotowire:', err.message);
    return [];
  }
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
function detectEdges(games, edgeThreshold = 0.03, minOdds = -250) {
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

// Format the edge analysis for Claude with extended thinking
function analyzeEdges(games) {
  // System prompt for NBA betting analysis with extended thinking
  const systemPrompt = `You are BetAnalyst, an expert NBA betting analysis system with deep knowledge of basketball statistics, team dynamics, player performance metrics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

CAPABILITIES:
- Deep statistical analysis of NBA games and player performance
- Pattern recognition across historical data
- Evaluation of betting lines and value identification
- Clear communication of complex insights through markdown tables

ANALYSIS FRAMEWORK:
1. Data assessment: Evaluate the quality and completeness of available information
2. Context establishment: Consider team history, recent performance, injuries, etc.
3. Statistical breakdown: Analyze relevant metrics and identify patterns
4. Line evaluation: Compare your analysis to available betting lines
5. Risk assessment: Evaluate confidence levels and potential uncertainties
6. Recommendation formulation: Provide clear, data-supported suggestions

Follow a structured analytical process and show all steps before providing recommendations.
Format ALL statistical comparisons and betting recommendations in clean markdown tables.

TABLE FORMATS:
1. For team comparisons:
| Metric | Team A | Team B | Advantage |
| ------ | ------ | ------ | --------- |
| [stat] | [value] | [value] | [team] |

2. For betting recommendations:
| Bet Type | Recommendation | Odds | Confidence | Key Factors |
| -------- | -------------- | ---- | ---------- | ----------- |
| [type] | [bet] | [odds] | [H/M/L] | [reasons] |

3. For player prop recommendations:
| Player | Prop | Line | Recommendation | Confidence |
| ------ | ---- | ---- | -------------- | ---------- |
| [name] | [stat] | [value] | [Over/Under] | [H/M/L] |

Always provide a confidence level (High/Medium/Low) for each recommendation based on statistical certainty.
Bold the most important insights and recommendations.`;

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

// Main analysis function with enhanced injury handling and extended thinking
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

  // Create complete analysis for Claude with extended thinking
  let completeAnalysis = edgeAnalysis;

  // Enhanced injury section with better organization and more details
  if (injuryData.injuries && injuryData.injuries.length > 0) {
    completeAnalysis += "\n\n## Key Injuries & Lineup Changes\n\n";

    // Group injuries by team for better organization
    const teamInjuries = {};

    injuryData.injuries.forEach(injury => {
      if (!teamInjuries[injury.team]) {
        teamInjuries[injury.team] = [];
      }
      teamInjuries[injury.team].push(injury);
    });

    // Add injuries team by team
    Object.keys(teamInjuries).sort().forEach(team => {
      completeAnalysis += `### ${team}\n`;

      // Sort injuries by status severity (Out > Doubtful > Questionable > Probable)
      const statusPriority = {
        'Out': 0,
        'Doubtful': 1,
        'Questionable': 2,
        'Probable': 3,
        'Day-To-Day': 4
      };

      teamInjuries[team].sort((a, b) => {
        // First sort by status priority
        const aPriority = statusPriority[a.status] ?? 999;
        const bPriority = statusPriority[b.status] ?? 999;
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Then alphabetically by player name
        return a.player.localeCompare(b.player);
      });

      teamInjuries[team].forEach(injury => {
        let injuryText = `- **${injury.player}** (${injury.status}) - ${injury.details}`;

        // Add return date if available
        if (injury.returnDate && injury.returnDate !== 'Unknown') {
          // Format date to be more readable
          const returnDate = new Date(injury.returnDate);
          const formattedDate = returnDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });

          injuryText += ` (Expected return: ${formattedDate})`;
        }

        // Add additional comment if available and it's not too long
        if (injury.comment && injury.comment.length > 0 && injury.comment.length < 200) {
          injuryText += `\n  - *${injury.comment.split('.')[0].trim()}.*`;
        }

        completeAnalysis += `${injuryText}\n`;
      });

      completeAnalysis += "\n";
    });

    // Add a note about the injury data impact on betting
    completeAnalysis += "**Betting Impact:** Key injuries can significantly affect game outcomes and create value opportunities. ";

    // Highlight specific high-impact injuries
    const highImpactPlayers = ["Stephen Curry", "LeBron James", "Giannis Antetokounmpo", "Joel Embiid", "Nikola Jokic", "Luka Doncic", "Kevin Durant"];
    const highImpactInjuries = injuryData.injuries.filter(injury =>
      highImpactPlayers.includes(injury.player) && (injury.status === "Out" || injury.status === "Doubtful")
    );

    if (highImpactInjuries.length > 0) {
      completeAnalysis += "Pay particular attention to ";
      completeAnalysis += highImpactInjuries.map(i => `**${i.player} (${i.status})**`).join(", ");
      completeAnalysis += " as these absences can significantly alter game dynamics and create value in certain markets.\n\n";
    } else {
      completeAnalysis += "Currently, there are no superstar-level players with 'Out' designations that would dramatically shift line values.\n\n";
    }
  } else {
    completeAnalysis += "\n\n## Key Injuries & Lineup Changes\n\n";
    completeAnalysis += "No significant injuries reported at this time. Always check for last-minute lineup changes before placing bets.\n\n";
  }

  // Add playoff context if we're in the playoffs
  const currentDate = new Date();
  const isPlayoffSeason = currentDate.getMonth() >= 3 && currentDate.getMonth() <= 5; // April-June

  if (isPlayoffSeason) {
    completeAnalysis += "\n\n## Playoff Context\n\n";

    try {
      // Get real playoff data from ESPN API
      const playoffResponse = await axios.get('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2025');

      if (playoffResponse.data && playoffResponse.data.standings) {
        // Extract playoff matchups and series standings

        // Eastern Conference
        const eastTeams = playoffResponse.data.standings.entries
          .filter(entry => entry.group && entry.group.name === "Eastern Conference")
          .sort((a, b) => {
            const aSeed = a.stats.find(s => s.name === "playoffSeed");
            const bSeed = b.stats.find(s => s.name === "playoffSeed");
            return (aSeed ? aSeed.value : 999) - (bSeed ? bSeed.value : 999);
          });

        // Western Conference
        const westTeams = playoffResponse.data.standings.entries
          .filter(entry => entry.group && entry.group.name === "Western Conference")
          .sort((a, b) => {
            const aSeed = a.stats.find(s => s.name === "playoffSeed");
            const bSeed = b.stats.find(s => s.name === "playoffSeed");
            return (aSeed ? aSeed.value : 999) - (bSeed ? bSeed.value : 999);
          });

        // Format matchups text
        completeAnalysis += "Current playoff matchups based on standings:\n";

        // First round matchups - East
        if (eastTeams.length >= 8) {
          completeAnalysis += "- Eastern Conference: ";
          completeAnalysis += `#1 ${eastTeams[0].team.displayName} vs #8 ${eastTeams[7].team.displayName}, `;
          completeAnalysis += `#2 ${eastTeams[1].team.displayName} vs #7 ${eastTeams[6].team.displayName}, `;
          completeAnalysis += `#3 ${eastTeams[2].team.displayName} vs #6 ${eastTeams[5].team.displayName}, `;
          completeAnalysis += `#4 ${eastTeams[3].team.displayName} vs #5 ${eastTeams[4].team.displayName}\n`;
        }

        // First round matchups - West
        if (westTeams.length >= 8) {
          completeAnalysis += "- Western Conference: ";
          completeAnalysis += `#1 ${westTeams[0].team.displayName} vs #8 ${westTeams[7].team.displayName}, `;
          completeAnalysis += `#2 ${westTeams[1].team.displayName} vs #7 ${westTeams[6].team.displayName}, `;
          completeAnalysis += `#3 ${westTeams[2].team.displayName} vs #6 ${westTeams[5].team.displayName}, `;
          completeAnalysis += `#4 ${westTeams[3].team.displayName} vs #5 ${westTeams[4].team.displayName}\n`;
        }
      } else {
        // Fallback to hardcoded data if API fails
        completeAnalysis += "Current playoff matchups:\n";
        completeAnalysis += "- Eastern Conference: Cavaliers vs. Pacers (Pacers lead 2-1), Celtics vs. Knicks (Knicks lead 2-0)\n";
        completeAnalysis += "- Western Conference: Thunder vs. Nuggets (Series tied 1-1), Timberwolves vs. Warriors (Series tied 1-1)\n";
      }
    } catch (err) {
      console.error('Failed to fetch playoff data:', err.message);

      // Fallback to hardcoded data
      completeAnalysis += "Current playoff matchups:\n";
      completeAnalysis += "- Eastern Conference: Cavaliers vs. Pacers (Pacers lead 2-1), Celtics vs. Knicks (Knicks lead 2-0)\n";
      completeAnalysis += "- Western Conference: Thunder vs. Nuggets (Series tied 1-1), Timberwolves vs. Warriors (Series tied 1-1)\n";
    }

    // Connect injuries to playoff matchups
    if (injuryData.injuries && injuryData.injuries.length > 0) {
      completeAnalysis += "\n### Injury Impact on Playoff Matchups\n";

      // Identify injury impacts on specific matchups
      // Warriors vs Timberwolves matchup specifically
      const warriorsInjuries = injuryData.injuries.filter(i => i.team === "Golden State Warriors" && i.status === "Out");
      const timberwolvesInjuries = injuryData.injuries.filter(i => i.team === "Minnesota Timberwolves" && i.status === "Out");

      if (warriorsInjuries.length > 0 || timberwolvesInjuries.length > 0) {
        completeAnalysis += "**Warriors vs Timberwolves:** ";

        if (warriorsInjuries.length > 0) {
          completeAnalysis += `Warriors missing ${warriorsInjuries.map(i => i.player).join(", ")}. `;

          // Specifically mention Curry as he's a key player
          if (warriorsInjuries.some(i => i.player === "Stephen Curry")) {
            completeAnalysis += "Curry's absence significantly impacts Warriors' offensive firepower and spacing. ";
          }
        }

        if (timberwolvesInjuries.length > 0) {
          completeAnalysis += `Timberwolves missing ${timberwolvesInjuries.map(i => i.player).join(", ")}. `;
        }

        completeAnalysis += "\n";
      }

      // Check other matchups similarly
      // (Code for other matchups would go here)
    }

    completeAnalysis += "\n### Playoff Betting Considerations\n";
    completeAnalysis += "1. Teams often have more detailed gameplans for specific opponents\n";
    completeAnalysis += "2. Minutes distributions become more predictable as rotations tighten\n";
    completeAnalysis += "3. Adjustments between games can create significant edges\n";
    completeAnalysis += "4. Public perception can heavily influence lines after notable performances\n";
    completeAnalysis += "5. Home court advantage is typically magnified in playoff settings\n";
  }

  completeAnalysis += "\n\nPlease analyze these betting opportunities, focusing on the statistical edges. ";

  if (injuryData.injuries && injuryData.injuries.length > 0) {
    completeAnalysis += "Consider how these injuries might impact the identified betting edges. ";

    // Specifically highlight Curry's absence if he's injured
    const currySidelined = injuryData.injuries.some(
      i => i.player === "Stephen Curry" && i.team === "Golden State Warriors" && i.status === "Out"
    );

    if (currySidelined) {
      completeAnalysis += "Pay particular attention to how **Stephen Curry's absence** affects Warriors games, including team totals, spreads, and player props for other Warriors players who will see increased usage. ";
    }
  }

  if (isPlayoffSeason) {
    completeAnalysis += "Factor in the playoff context and how series dynamics might influence upcoming games. ";
  }

  completeAnalysis += "Identify which markets (moneyline, spread, totals, player props) currently show the greatest inefficiencies based on the data. ";

  // Request specific bet recommendations with exact table formatting
  completeAnalysis += "IMPORTANT: After your analysis, provide exactly 3-5 concrete bet recommendations in a section called \"RECOMMENDED BETS\". Format these recommendations as a markdown table with these exact columns: Game/Series, Bet Type, Selection, Odds, Stake (1-5 units), and Reasoning. Include REAL ODDS from the data (not XXX placeholders). For each bet, provide a short but clear explanation of why this specific bet has value. Make sure to consider current injuries and playoff dynamics in your selections.";

  // Enhanced system prompt for Claude to focus on proper table formatting and precise recommendations
  const systemPrompt = `You are BetAnalyst, an expert NBA betting analysis system with deep knowledge of basketball statistics, team dynamics, player performance metrics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

FORMATTING REQUIREMENTS:
1. Always create a section called "RECOMMENDED BETS" with exactly 3-5 specific bet recommendations
2. Format these recommendations in a properly structured markdown table with these exact columns:
   | Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
3. Use real odds values from the provided data (never use placeholders)
4. Assign stakes between 1-5 units based on your confidence level
5. Provide clear, concise reasoning for each recommendation

TABLE EXAMPLE:
| Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
|-------------|----------|-----------|------|-------|-----------|
| Lakers vs Warriors | Spread | Warriors +3.5 | -110 | 3 | Warriors strong ATS as road underdogs; Curry returns tonight |
| Celtics vs Bucks | Total | Under 219.5 | -108 | 2 | Both teams in bottom 10 of pace; playoff defensive intensity |

Even if you don't find strong edges, still provide at least 3 recommendations with appropriate lower stakes and clear explanations of the limited confidence.`;

  // Configure askClaude with extended thinking parameters
  const options = {
    systemPrompt: systemPrompt,
    thinkingBudget: 12000,  // Reduced thinking budget
    maxTokens: 16000,       // Increased max tokens to be greater than thinking budget
    temperature: 1,         // Must be exactly 1 when using extended thinking
    includeThinking: true   // Retain thinking for analysis transparency
  };

  // Send to Claude for analysis
  const claudeResponse = await askClaude(completeAnalysis, options);

  // Extract just the final response for the report
  const claudeAnalysis = claudeResponse.finalResponse || claudeResponse;

  // If available, log Claude's thinking process for debugging
  if (claudeResponse.thinking) {
    // Save Claude's reasoning to a file for later inspection
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const thinkingPath = path.join(__dirname, 'reports', dateStr, `claude_reasoning_${timeStr}.md`);

    try {
      // Ensure directory exists
      const dirPath = path.join(__dirname, 'reports', dateStr);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(thinkingPath, claudeResponse.thinking);
      console.log(`Claude's reasoning process saved to ${thinkingPath}`);
    } catch (err) {
      console.error('Error saving Claude reasoning:', err.message);
    }
  }

  return claudeAnalysis;
}

// MAIN EXECUTION
(async () => {
  console.log('🔍 Analyzing NBA betting opportunities with extended thinking...');

  // Check if required API keys are set
  if (!process.env.ODDS_API_KEY) {
    console.error('ERROR: ODDS_API_KEY not found in environment variables');
    console.log('Please set your API key by running:');
    console.log('export ODDS_API_KEY=your_api_key_here');
    process.exit(1);
  }

  if (!process.env.CLAUDE_API_KEY) {
    console.error('ERROR: CLAUDE_API_KEY not found in environment variables');
    console.log('Please set your API key by running:');
    console.log('export CLAUDE_API_KEY=your_api_key_here');
    process.exit(1);
  }

  // Check if we're in playoff season
  const currentDate = new Date();
  const isPlayoffSeason = currentDate.getMonth() >= 3 && currentDate.getMonth() <= 5; // April-June

  try {
    console.log('Beginning analysis with Edge Extended Thinking...');

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

      // Check if the betSection actually contains a table
      if (betSection.includes('|')) {
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
*Generated by NBA Edge Detection System with Edge Extended Thinking on ${dateStr} at ${timeStr.replace(/-/g, ':')}*
`;

        const betsPath = path.join(dateDir, `recommended_bets_${dateTimeStr}.md`);
        fs.writeFileSync(betsPath, betsMd);
        console.log(`📊 Recommended bets saved to ${betsPath}`);

        // Also create an HTML version for better table viewing
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
        console.log('\n⚠️ "RECOMMENDED BETS" section found but no table of bets included');
        console.log('This likely indicates a formatting issue with Claude\'s response.');
        console.log('Check the full analysis and consider adjusting the system prompt to emphasize proper table formatting.');
      }
    } else {
      console.log('\n⚠️ No recommended bets found in analysis');
      console.log('Consider adjusting the threshold for edge detection or running the analysis at a different time when more betting opportunities may be available.');
    }
  } catch (error) {
    console.error('An error occurred during analysis:', error);
  }
})();

// NBABettingAnalyzer class for more modular and reusable betting analysis
class NBABettingAnalyzer {
  constructor(apiKey) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.CLAUDE_API_KEY,
    });

    this.systemPrompt = `You are BetAnalyst, an expert NBA betting analysis system with deep knowledge of basketball statistics, team dynamics, player performance metrics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

CAPABILITIES:
- Deep statistical analysis of NBA games and player performance
- Pattern recognition across historical data
- Evaluation of betting lines and value identification
- Clear communication of complex insights through markdown tables

ANALYSIS FRAMEWORK:
1. Data assessment: Evaluate the quality and completeness of available information
2. Context establishment: Consider team history, recent performance, injuries, etc.
3. Statistical breakdown: Analyze relevant metrics and identify patterns
4. Line evaluation: Compare your analysis to available betting lines
5. Risk assessment: Evaluate confidence levels and potential uncertainties
6. Recommendation formulation: Provide clear, data-supported suggestions

Follow a structured analytical process and show all steps before providing recommendations.
Format ALL statistical comparisons and betting recommendations in clean markdown tables.

TABLE FORMATS:
1. For team comparisons:
| Metric | Team A | Team B | Advantage |
| ------ | ------ | ------ | --------- |
| [stat] | [value] | [value] | [team] |

2. For betting recommendations:
| Bet Type | Recommendation | Odds | Confidence | Key Factors |
| -------- | -------------- | ---- | ---------- | ----------- |
| [type] | [bet] | [odds] | [H/M/L] | [reasons] |

3. For player prop recommendations:
| Player | Prop | Line | Recommendation | Confidence |
| ------ | ---- | ---- | -------------- | ---------- |
| [name] | [stat] | [value] | [Over/Under] | [H/M/L] |

Always provide a confidence level (High/Medium/Low) for each recommendation based on statistical certainty.
Bold the most important insights and recommendations.`;
  }

  async analyzeGame(game, metrics, options = {}) {
    const thinkingBudget = options.thinkingBudget || 12000;
    const maxTokens = options.maxTokens || 16000; // Increased to be larger than thinkingBudget
    const includeReasoning = options.includeReasoning !== false;

    // Format the prompt with game details
    const userPrompt = `Analyze the following NBA game for betting opportunities:
Game: ${game.homeTeam} vs ${game.awayTeam}
Date: ${game.date}
Betting Lines:
- Spread: ${game.spread}
- Total: ${game.total}
- Moneyline: Home ${game.homeMoneyline} / Away ${game.awayMoneyline}

${metrics ? `Key metrics: ${JSON.stringify(metrics, null, 2)}` : ''}
${game.injuries ? `Injuries: ${JSON.stringify(game.injuries, null, 2)}` : ''}
${game.notes ? `Additional Notes: ${game.notes}` : ''}

Provide a detailed analysis of betting opportunities with your confidence level.
Format your final recommendations in clean markdown tables.`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: maxTokens,
        temperature: 1,  // Must be exactly 1 when using extended thinking
        thinking: {
          type: "enabled",
          budget_tokens: thinkingBudget
        },
        system: this.systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ]
      });

      // Process the response
      const thinking = response.content
        .filter(block => block.type === "thinking")
        .map(block => block.thinking)
        .join("\n\n");

      const hasRedactedThinking = response.content.some(
        block => block.type === "redacted_thinking"
      );

      const finalResponse = response.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("");

      return {
        game: {
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: game.date
        },
        analysis: finalResponse,
        reasoning: includeReasoning ? thinking : null,
        hasRedactedReasoning: hasRedactedThinking,
        fullResponse: response
      };
    } catch (error) {
      console.error("Error analyzing game:", error);
      throw error;
    }
  }

  async analyzePlayerProps(game, players, options = {}) {
    const thinkingBudget = options.thinkingBudget || 12000;
    const maxTokens = options.maxTokens || 16000; // Increased to be larger than thinkingBudget

    // Format player props for analysis
    const playerPropsFormatted = players.map(player =>
      `- ${player.name}: ${Object.entries(player.props).map(([prop, value]) =>
        `${prop} (${value})`).join(', ')}`
    ).join('\n');

    const userPrompt = `Analyze the following NBA player props for betting opportunities:
Game: ${game.homeTeam} vs ${game.awayTeam}
Date: ${game.date}

Player Props:
${playerPropsFormatted}

${game.injuries ? `Injuries: ${JSON.stringify(game.injuries, null, 2)}` : ''}
${game.notes ? `Additional Notes: ${game.notes}` : ''}

Analyze each player prop bet opportunity and provide recommendations in a markdown table with the following format:
| Player | Prop | Line | Recommendation | Confidence | Key Factors |`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: maxTokens,
        temperature: 1,  // Must be exactly 1 when using extended thinking
        thinking: {
          type: "enabled",
          budget_tokens: thinkingBudget
        },
        system: this.systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ]
      });

      // Process the response
      const thinking = response.content
        .filter(block => block.type === "thinking")
        .map(block => block.thinking)
        .join("\n\n");

      const hasRedactedThinking = response.content.some(
        block => block.type === "redacted_thinking"
      );

      const finalResponse = response.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("");

      return {
        game: {
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: game.date
        },
        analysis: finalResponse,
        reasoning: thinking,
        hasRedactedReasoning: hasRedactedThinking,
        fullResponse: response
      };
    } catch (error) {
      console.error("Error analyzing player props:", error);
      throw error;
    }
  }
}

module.exports = {
  getNbaOdds,
  askClaude,
  getInjuryData,
  analyzeBettingOpportunities,
  NBABettingAnalyzer
};
