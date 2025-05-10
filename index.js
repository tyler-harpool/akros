require('dotenv').config();
const fs = require('fs');
const path = require('path');
const marked = require('marked');

// Import modules
const { getNbaOdds } = require('./lib/odds-api');
const { getInjuryData } = require('./lib/injury-data');
const { createComprehensivePrompt } = require('./lib/formatter');
const analyzer = require('./lib/analyzer');
const NBABettingAnalyzer = require('./lib/NBABettingAnalyzer');
const { Anthropic } = require('@anthropic-ai/sdk');

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Enhanced askClaude function with extended thinking capabilities
async function askClaude(prompt, options = {}) {
  const {
    thinkingBudget = 12000,
    maxTokens = 16000,
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
      temperature: temperature,
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

    // Process the response
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
  // Implementation details...
  return "Standard Claude response would be here";
}

// Main analysis function
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

  // Create a comprehensive prompt with all relevant data
  const completeAnalysis = createComprehensivePrompt(oddsData, injuryData, analyzer);

  // Save the raw prompt for inspection
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Create prompt directory if it doesn't exist
  const promptDir = path.join('prompts', dateStr);
  if (!fs.existsSync(promptDir)) {
    fs.mkdirSync(promptDir, { recursive: true });
  }

  // Save the prompt
  const promptPath = path.join(promptDir, `claude_prompt_${timestamp}.md`);
  fs.writeFileSync(promptPath, completeAnalysis);
  console.log(`📋 Claude's input prompt saved to ${promptPath}`);

  // Enhanced system prompt for Claude
  const systemPrompt = `You are BetAnalyst, an expert NBA betting analysis system with deep knowledge of basketball statistics, team dynamics, player performance metrics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

FORMATTING REQUIREMENTS:
1. Always create a section called "RECOMMENDED BETS" with exactly 3-5 specific bet recommendations
2. Format these recommendations in a properly structured markdown table with these exact columns:
   | Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
3. Use real odds values from the provided data (never use placeholders)
4. Assign stakes between 1-5 units based on your confidence level
5. Provide clear, concise reasoning for each recommendation`;

  // Configure askClaude with extended thinking parameters
  const options = {
    systemPrompt: systemPrompt,
    thinkingBudget: 12000,
    maxTokens: 16000,
    temperature: 1,
    includeThinking: true
  };

  // Send to Claude for analysis
  const claudeResponse = await askClaude(completeAnalysis, options);

  // Extract just the final response for the report
  const claudeAnalysis = claudeResponse.finalResponse || claudeResponse;

  // If available, log Claude's thinking process for debugging
  if (claudeResponse.thinking) {
    // Create reports directory
    const reportsDir = path.join('reports');
    const dateDir = path.join(reportsDir, dateStr);

    // Ensure directories exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }

    // Save Claude's reasoning to a file
    const thinkingPath = path.join(dateDir, `claude_reasoning_${timestamp}.md`);
    fs.writeFileSync(thinkingPath, claudeResponse.thinking);
    console.log(`🧠 Claude's reasoning process saved to ${thinkingPath}`);

    // Create a latest directory for easy access to most recent files
    const latestDir = path.join(reportsDir, 'latest');
    if (!fs.existsSync(latestDir)) {
      fs.mkdirSync(latestDir, { recursive: true });
    }

    // Copy thinking to latest
    fs.copyFileSync(thinkingPath, path.join(latestDir, 'latest_thinking.md'));
    fs.copyFileSync(promptPath, path.join(latestDir, 'latest_prompt.md'));
  }

  // Create a variable to store the thinking path for the return value
  const finalThinkingPath = claudeResponse.thinking ?
    path.join(path.join('reports', dateStr), `claude_reasoning_${timestamp}.md`) :
    null;

  return {
    analysis: claudeAnalysis,
    timestamp: timestamp,
    promptPath: promptPath,
    thinkingPath: finalThinkingPath
  };
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

  try {
    console.log('Beginning analysis with Claude extended thinking...');

    // Get analysis results and metadata
    const result = await analyzeBettingOpportunities();
    const { analysis, timestamp, promptPath } = result;

    // Get current date for directories
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Setup directory structure
    const baseDir = path.join('reports');
    const dateDir = path.join(baseDir, dateStr);

    // Ensure directories exist (redundant but safe)
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }

    // Create latest directory if needed
    const latestDir = path.join(baseDir, 'latest');
    if (!fs.existsSync(latestDir)) {
      fs.mkdirSync(latestDir, { recursive: true });
    }

    // Save complete analysis as markdown
    const fullReportPath = path.join(dateDir, `nba_edge_analysis_${timestamp}.md`);
    fs.writeFileSync(fullReportPath, analysis);
    console.log(`\n📝 Full analysis saved to ${fullReportPath}`);

    // Copy to latest directory
    fs.copyFileSync(fullReportPath, path.join(latestDir, 'latest_analysis.md'));

    // Extract and save just the recommended bets section
    if (analysis.includes('RECOMMENDED BETS')) {
      console.log('\n🎯 RECOMMENDED BETS FOUND');

      // Extract the table section
      let betSection = analysis.split('RECOMMENDED BETS')[1];
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
*Generated by NBA Edge Detection System with Claude Extended Thinking on ${dateStr} at ${timestamp}*
`;

        const betsPath = path.join(dateDir, `recommended_bets_${timestamp}.md`);
        fs.writeFileSync(betsPath, betsMd);
        console.log(`📊 Recommended bets saved to ${betsPath}`);

        // Copy to latest directory
        fs.copyFileSync(betsPath, path.join(latestDir, 'latest_bets.md'));

        // Create HTML version
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

        const htmlPath = path.join(dateDir, `recommended_bets_${timestamp}.html`);
        fs.writeFileSync(htmlPath, htmlContent);
        console.log(`🌐 HTML version saved to ${htmlPath}`);

        // Copy HTML to latest directory
        fs.copyFileSync(htmlPath, path.join(latestDir, 'latest_bets.html'));

        // Display the bets in the console
        console.log('\n' + betsMd);

        // Create/update summary JSON
        createSummaryFile(baseDir, {
          timestamp: timestamp,
          numGames: 0, // You would get this from oddsData.length
          betsFound: true,
          numBets: (betSection.match(/\|\s*[^|]+\s*\|/g) || []).length - 1, // Subtract header row
          files: {
            analysis: fullReportPath,
            bets: betsPath,
            html: htmlPath,
            prompt: promptPath,
            thinking: result.thinkingPath
          }
        });
      } else {
        console.log('\n⚠️ "RECOMMENDED BETS" section found but no table of bets included');
        console.log('This likely indicates a formatting issue with Claude\'s response.');

        createSummaryFile(baseDir, {
          timestamp: timestamp,
          betsFound: false,
          error: "RECOMMENDED BETS section found but no table included",
          files: {
            analysis: fullReportPath,
            prompt: promptPath,
            thinking: result.thinkingPath
          }
        });
      }
    } else {
      console.log('\n⚠️ No recommended bets found in analysis');
      console.log('Consider adjusting the threshold for edge detection or running the analysis at a different time when more betting opportunities may be available.');

      createSummaryFile(baseDir, {
        timestamp: timestamp,
        betsFound: false,
        error: "No RECOMMENDED BETS section found in analysis",
        files: {
          analysis: fullReportPath,
          prompt: promptPath,
          thinking: result.thinkingPath
        }
      });
    }
  } catch (error) {
    console.error('An error occurred during analysis:', error);

    // Try to record error in summary
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      const baseDir = path.join('reports');

      createSummaryFile(baseDir, {
        timestamp: timestamp,
        error: error.message || "Unknown error",
        stack: error.stack,
        success: false
      });
    } catch (e) {
      console.error('Could not record error in summary file:', e);
    }
  }
})();

// Helper function to create/update summary file
function createSummaryFile(baseDir, runData) {
  const summaryPath = path.join(baseDir, 'summary.json');
  let summary = {
    lastRun: runData.timestamp,
    runs: []
  };

  // Add top-level data
  Object.keys(runData).forEach(key => {
    if (key !== 'files') {
      summary[key] = runData[key];
    }
  });

  // Load existing summary if it exists and append the new run
  if (fs.existsSync(summaryPath)) {
    try {
      const existingSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (existingSummary.runs) {
        // Keep existing runs but add new one at the start
        summary.runs = [runData, ...existingSummary.runs.slice(0, 19)];
      } else {
        summary.runs = [runData];
      }

      // Preserve any other existing summary fields
      Object.keys(existingSummary).forEach(key => {
        if (key !== 'runs' && key !== 'lastRun' && !runData.hasOwnProperty(key)) {
          summary[key] = existingSummary[key];
        }
      });
    } catch (err) {
      console.error('Error reading summary file:', err.message);
      summary.runs = [runData];
    }
  } else {
    summary.runs = [runData];
  }

  // Write the summary file
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📊 Summary updated at ${summaryPath}`);
}
