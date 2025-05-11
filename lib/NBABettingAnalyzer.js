const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

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

FORMAT ALL statistical comparisons and betting recommendations in clean markdown tables.

TABLE FORMATS:
1. For team comparisons:
| Metric | Team A | Team B | Advantage |
| ------ | ------ | ------ | --------- |
| [stat] | [value] | [value] | [team] |

2. For betting recommendations:
| Game/Series | Bet Type | Selection | Odds | Stake | Reasoning |
|-------------|----------|-----------|------|-------|-----------|
| [game] | [type] | [bet] | [odds] | [1-5] | [reasons] |

Always provide a confidence level and clear reasoning for each recommendation.
Bold the most important insights and recommendations.`;
  }

  async analyzeGame(game, metrics, options = {}) {
    const thinkingBudget = options.thinkingBudget || 12000;
    const maxTokens = options.maxTokens || 16000;
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
Format your final recommendations in a markdown table with these columns: Bet Type, Selection, Odds, Stake (1-5 units), and Reasoning.`;

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
    const maxTokens = options.maxTokens || 16000;

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

      // Process response
      // Implementation details...

      return {
        game: {
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: game.date
        },
        analysis: "Analysis results would be here",
        reasoning: "Thinking process would be here",
        hasRedactedReasoning: false,
        fullResponse: response
      };
    } catch (error) {
      console.error("Error analyzing player props:", error);
      throw error;
    }
  }
}

module.exports = NBABettingAnalyzer;
