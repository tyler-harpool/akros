/**
 * Extended Thinking Sports Betting Analyzer
 * 
 * This module uses Claude's Extended Thinking capability to perform deep analysis
 * of sports betting opportunities for NBA, MLB, and NHL.
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

/**
 * A class to handle sports betting analysis using Claude's Extended Thinking capability
 */
class ExtendedThinkingAnalyzer {
  /**
   * Initialize the Extended Thinking Analyzer
   * @param {string} apiKey - The Anthropic Claude API key
   */
  constructor(apiKey) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.CLAUDE_API_KEY,
    });

    // Initialize default system prompts for different sports
    this.systemPrompts = {
      nba: this.createNbaSystemPrompt(),
      mlb: this.createMlbSystemPrompt(),
      nhl: this.createNhlSystemPrompt()
    };
  }

  /**
   * Create system prompt optimized for NBA betting analysis with extended thinking
   * @returns {string} The system prompt for NBA analysis
   */
  createNbaSystemPrompt() {
    return `You are BetAnalyst, an expert NBA betting analysis system with deep knowledge of basketball statistics, team dynamics, player performance metrics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

REQUIRED STRUCTURED THINKING PROCESS:
1. DATA ASSESSMENT - First evaluate all available information:
   - Odds data across bookmakers
   - Recent team performance metrics
   - Injury information and lineup impacts
   - Head-to-head history
   - Relevant situational factors (back-to-backs, travel, etc.)

2. IDENTIFY KEY FACTORS - For each game, explicitly list the 3-5 most important factors that will influence the outcome

3. DETAILED FACTOR ANALYSIS - For each key factor:
   - Provide relevant statistics and context
   - Assess how this factor impacts spread, moneyline, and totals
   - Assign a weight/importance to this factor
   - Consider counterarguments or alternative interpretations

4. MARKET EVALUATION - Compare your analysis to available odds:
   - Calculate true/fair probabilities based on your analysis
   - Compare to implied probabilities from odds
   - Identify markets with largest discrepancies
   - Assess line movement and CLV potential

5. FINAL RECOMMENDATIONS - For your strongest betting opportunities:
   - Rate confidence (High/Medium/Low)
   - Provide exact stake sizing (1-5 units)
   - Explain clear reasoning for each bet
   - Note any key factors that could invalidate the recommendation

FORMATTING REQUIREMENTS:
1. Always create a section called "RECOMMENDED BETS" with exactly 3-5 specific bet recommendations
2. Format these recommendations in a properly structured markdown table with these exact columns:
   | Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
3. Use real odds values from the provided data (never use placeholders)
4. Assign stakes between 1-5 units based on your confidence level

DECISION FRAMEWORK:
- Bet 1 unit: Low confidence, small edge (2-3%)
- Bet 2 units: Medium confidence, moderate edge (3-5%)
- Bet 3 units: High confidence, significant edge (5-7%)
- Bet 4-5 units: Very high confidence, large edge (>7%)`;
  }

  /**
   * Create system prompt optimized for MLB betting analysis with extended thinking
   * @returns {string} The system prompt for MLB analysis
   */
  createMlbSystemPrompt() {
    return `You are BetAnalyst, an expert MLB betting analysis system with deep knowledge of baseball statistics, pitcher metrics, team performance, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

REQUIRED STRUCTURED THINKING PROCESS:
1. DATA ASSESSMENT - First evaluate all available information:
   - Starting pitcher matchups and metrics (ERA, FIP, xFIP, WHIP, K%, BB%)
   - Bullpen availability and performance metrics
   - Team offensive metrics vs. LHP/RHP
   - Ballpark factors and weather conditions
   - Umpire tendencies (if available)
   - Lineup information and key injuries

2. STARTING PITCHER ANALYSIS - For each starting pitcher:
   - Recent performance trend (last 3-5 starts)
   - Season-long metrics vs. career norms
   - Splits against opponent's lineup
   - Home/away performance differences
   - Pitch arsenal effectiveness vs. opponent

3. TEAM OFFENSE EVALUATION - For each team:
   - Performance vs. similar pitcher types
   - Recent offensive production (last 10 games)
   - Hot/cold hitters in lineup
   - Platoon advantages/disadvantages

4. SITUATIONAL FACTORS - Consider crucial context:
   - Travel/rest situation for both teams
   - Day/night game impacts
   - Weather forecast (wind direction, temperature)
   - Lineup changes from projected

5. MARKET EVALUATION - Compare your analysis to available odds:
   - Calculate true/fair win probabilities
   - Examine run line and total implications
   - Identify prop bet opportunities
   - Assess potential for late line movement

6. FINAL RECOMMENDATIONS - For your strongest betting opportunities:
   - Rate confidence (High/Medium/Low)
   - Provide exact stake sizing (1-5 units)
   - Explain clear reasoning for each bet
   - Note conditions that might change your recommendation

FORMATTING REQUIREMENTS:
1. Always create a section called "RECOMMENDED BETS" with exactly 3-5 specific bet recommendations
2. Format these recommendations in a properly structured markdown table with these exact columns:
   | Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
3. Use real odds values from the provided data (never use placeholders)
4. Assign stakes between 1-5 units based on your confidence level

DECISION FRAMEWORK:
- Bet 1 unit: Low confidence, small edge (2-3%)
- Bet 2 units: Medium confidence, moderate edge (3-5%)
- Bet 3 units: High confidence, significant edge (5-7%)
- Bet 4-5 units: Very high confidence, large edge (>7%)`;
  }

  /**
   * Create system prompt optimized for NHL betting analysis with extended thinking
   * @returns {string} The system prompt for NHL analysis
   */
  createNhlSystemPrompt() {
    return `You are BetAnalyst, an expert NHL betting analysis system with deep knowledge of hockey statistics, goaltender performance, team dynamics, and betting markets. Your analysis leverages Claude's extended thinking capabilities to provide transparent, step-by-step reasoning.

REQUIRED STRUCTURED THINKING PROCESS:
1. DATA ASSESSMENT - First evaluate all available information:
   - Goaltender matchups and metrics (SV%, GAA, GSAA)
   - Team offensive and defensive metrics
   - Special teams effectiveness (power play/penalty kill)
   - Recent form and injuries
   - Rest advantage/disadvantage
   - Home/away splits and travel factors

2. GOALTENDER ANALYSIS - For each starting goaltender:
   - Recent performance (last 3-5 games)
   - Season metrics vs. career averages
   - Performance against opponent
   - Fatigue factors (back-to-back starts, high shot volume games)

3. TEAM PERFORMANCE EVALUATION:
   - 5v5 underlying metrics (xGF, CF%, high-danger chances)
   - Special teams efficiency and matchup implications
   - Line matchups and coaching strategy
   - Recent scoring trends and shot generation

4. SITUATIONAL FACTORS - Consider crucial context:
   - Travel schedule impact (road trips, time zone changes)
   - Back-to-back games
   - Divisional/rivalry games vs. non-conference
   - Playoff positioning implications

5. MARKET EVALUATION - Compare your analysis to available odds:
   - Calculate true win probabilities
   - Examine puck line and total implications
   - Identify potential edges in prop markets
   - Consider live betting angles based on game script

6. FINAL RECOMMENDATIONS - For your strongest betting opportunities:
   - Rate confidence (High/Medium/Low)
   - Provide exact stake sizing (1-5 units)
   - Explain clear reasoning for each bet
   - Note key lineup confirmations needed before betting

FORMATTING REQUIREMENTS:
1. Always create a section called "RECOMMENDED BETS" with exactly 3-5 specific bet recommendations
2. Format these recommendations in a properly structured markdown table with these exact columns:
   | Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
3. Use real odds values from the provided data (never use placeholders)
4. Assign stakes between 1-5 units based on your confidence level

DECISION FRAMEWORK:
- Bet 1 unit: Low confidence, small edge (2-3%)
- Bet 2 units: Medium confidence, moderate edge (3-5%)
- Bet 3 units: High confidence, significant edge (5-7%)
- Bet 4-5 units: Very high confidence, large edge (>7%)`;
  }

  /**
   * Analyze sports betting opportunities using Claude's Extended Thinking
   * @param {string} sport - The sport to analyze ('nba', 'mlb', 'nhl')
   * @param {Object} data - The data to analyze (odds, injuries, etc.)
   * @param {Object} options - Additional options for the analysis
   * @returns {Object} The analysis results
   */
  async analyzeWithExtendedThinking(sport, data, options = {}) {
    const {
      thinkingBudget = 24000, // Increased thinking budget for deeper analysis
      maxTokens = 32000,      // Increased max tokens to handle larger analysis
      temperature = 1,        // Must be exactly 1 when using extended thinking
      includeThinking = true, // Whether to include the thinking process in the results
      saveThinking = true     // Whether to save the thinking process to a file
    } = options;

    // Select the appropriate system prompt based on the sport
    const systemPrompt = this.systemPrompts[sport.toLowerCase()] || this.systemPrompts.nba;
    
    // Format the data for Claude
    const formattedData = JSON.stringify(data, null, 2);
    
    // Create a detailed prompt for Claude with extended thinking instructions
    const userPrompt = this.createAnalysisPrompt(sport, formattedData);

    try {
      console.log(`Analyzing ${sport.toUpperCase()} betting opportunities with Extended Thinking...`);

      // Configure API parameters with extended thinking enabled
      const apiParams = {
        model: options.model || 'claude-3-7-sonnet-20250219',
        max_tokens: maxTokens,
        temperature: temperature, // Must be exactly 1 when using extended thinking
        thinking: {
          type: 'enabled',
          budget_tokens: thinkingBudget
        },
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      };

      // Make the API request
      const response = await this.anthropic.messages.create(apiParams);

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

      // Save the thinking process to a file if requested
      if (saveThinking && processedResponse.thinking) {
        await this.saveThinkingToFile(sport, processedResponse.thinking);
      }

      // Return the complete processed response or just the final response text
      return includeThinking ? processedResponse : processedResponse.finalResponse;
    } catch (err) {
      console.error(`Failed to analyze ${sport} with Extended Thinking:`, err.response?.data || err.message);
      console.error('Error details:', JSON.stringify(err.response?.data || err, null, 2));

      // If extended thinking fails, attempt to fallback to standard mode
      if (err.message.includes('thinking') || err.message.includes('budget')) {
        console.log('Falling back to standard mode without extended thinking...');
        return this.analyzeWithStandardThinking(sport, data, options);
      }

      return {
        finalResponse: `Error analyzing ${sport} betting opportunities. Please check API key and connection.`,
        error: err.message
      };
    }
  }

  /**
   * Create a detailed analysis prompt for a specific sport
   * @param {string} sport - The sport to analyze
   * @param {string} formattedData - The formatted data to analyze
   * @returns {string} The detailed analysis prompt
   */
  createAnalysisPrompt(sport, formattedData) {
    const sportTitle = sport.toUpperCase();
    
    // Common prompt structure for all sports
    let prompt = `# ${sportTitle} Betting Opportunity Analysis\n\n`;
    prompt += `I need you to analyze the following ${sportTitle} betting data using your Extended Thinking capability. Take your time to carefully consider all aspects of these games and identify the strongest betting opportunities.\n\n`;
    prompt += `Please follow these steps in your analysis:\n`;
    prompt += `1. Examine the odds data across different bookmakers\n`;
    prompt += `2. Analyze key matchup factors specific to ${sportTitle}\n`;
    prompt += `3. Consider injury impacts and lineup changes\n`;
    prompt += `4. Identify market inefficiencies and betting edges\n`;
    prompt += `5. Provide concrete betting recommendations with appropriate stake sizing\n\n`;
    prompt += `## Data for Analysis\n\n\`\`\`json\n${formattedData}\n\`\`\`\n\n`;
    
    // Sport-specific instructions
    if (sport.toLowerCase() === 'mlb') {
      prompt += `For MLB analysis, pay special attention to:\n`;
      prompt += `- Starting pitcher matchups and their recent performance\n`;
      prompt += `- Bullpen availability and effectiveness\n`;
      prompt += `- Team batting stats vs. LHP/RHP\n`;
      prompt += `- Ballpark factors and weather conditions\n`;
      prompt += `- Recent offensive performance trends\n\n`;
    } else if (sport.toLowerCase() === 'nhl') {
      prompt += `For NHL analysis, pay special attention to:\n`;
      prompt += `- Goaltender matchups and their recent performance\n`;
      prompt += `- Special teams effectiveness (power play/penalty kill)\n`;
      prompt += `- Rest advantages and travel factors\n`;
      prompt += `- Line matchups and coaching strategy\n`;
      prompt += `- Recent team performance trends\n\n`;
    } else { // NBA
      prompt += `For NBA analysis, pay special attention to:\n`;
      prompt += `- Matchup advantages at key positions\n`;
      prompt += `- Pace and style of play considerations\n`;
      prompt += `- Rest advantages and schedule factors\n`;
      prompt += `- Recent shooting and defensive performance\n`;
      prompt += `- Injury impacts on rotations\n\n`;
    }
    
    prompt += `After your detailed analysis, please provide 3-5 specific betting recommendations in a section called "RECOMMENDED BETS" with exact odds, stake sizes (1-5 units), and clear explanations.`;
    
    return prompt;
  }

  /**
   * Fallback method to analyze with standard thinking (no extended thinking)
   * @param {string} sport - The sport to analyze
   * @param {Object} data - The data to analyze
   * @param {Object} options - Additional options for the analysis
   * @returns {Object} The analysis results
   */
  async analyzeWithStandardThinking(sport, data, options = {}) {
    try {
      console.log(`Falling back to standard thinking for ${sport.toUpperCase()} analysis...`);
      
      const {
        maxTokens = 4096,
        temperature = 0.5,
      } = options;

      // Select the appropriate system prompt based on the sport
      const systemPrompt = this.systemPrompts[sport.toLowerCase()] || this.systemPrompts.nba;
      
      // Format the data for Claude
      const formattedData = JSON.stringify(data, null, 2);
      
      // Create a prompt for Claude without extended thinking instructions
      const userPrompt = this.createAnalysisPrompt(sport, formattedData);

      // Configure API parameters without extended thinking
      const apiParams = {
        model: options.model || 'claude-3-7-sonnet-20250219',
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      };

      const response = await this.anthropic.messages.create(apiParams);

      return {
        finalResponse: response.content[0].text,
        thinking: null,
        hasRedactedThinking: false,
        fullResponse: response
      };
    } catch (error) {
      console.error(`Error in standard thinking analysis for ${sport}:`, error);
      return {
        finalResponse: `Error analyzing ${sport} betting opportunities with standard thinking. Please check API key and connection.`,
        error: error.message
      };
    }
  }

  /**
   * Continue a conversation with preserved thinking context
   * @param {Array} conversation - The conversation history
   * @param {string} newUserMessage - The new user message
   * @param {Object} options - Additional options for the continuation
   * @returns {Object} The continued conversation results
   */
  async continueConversationWithThinking(conversation, newUserMessage, options = {}) {
    try {
      const {
        thinkingBudget = 24000,
        maxTokens = 32000,
        temperature = 1,
        sport = 'nba'
      } = options;

      // Select the appropriate system prompt based on the sport
      const systemPrompt = this.systemPrompts[sport.toLowerCase()] || this.systemPrompts.nba;

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
        model: options.model || 'claude-3-7-sonnet-20250219',
        max_tokens: maxTokens,
        temperature: temperature,
        thinking: {
          type: 'enabled',
          budget_tokens: thinkingBudget
        },
        system: systemPrompt,
        messages: messages
      };

      const response = await this.anthropic.messages.create(apiParams);

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
      return this.analyzeWithStandardThinking(options.sport || 'nba', {}, options);
    }
  }

  /**
   * Save the thinking process to a file
   * @param {string} sport - The sport being analyzed
   * @param {string} thinking - The thinking content to save
   */
  async saveThinkingToFile(sport, thinking) {
    try {
      // Format date for file naming
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      
      // Create directory path
      const dirPath = path.join(process.cwd(), 'reports', dateStr);
      const filePath = path.join(dirPath, `${sport.toLowerCase()}_claude_reasoning_${timeStr}.md`);
      
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Write the thinking content to the file
      fs.writeFileSync(filePath, thinking);
      
      console.log(`Claude's reasoning process for ${sport.toUpperCase()} saved to ${filePath}`);
    } catch (err) {
      console.error(`Error saving ${sport.toUpperCase()} reasoning:`, err.message);
    }
  }
}

module.exports = ExtendedThinkingAnalyzer;