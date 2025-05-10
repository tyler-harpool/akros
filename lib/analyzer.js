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

      // Process outcomes
      // Implementation details...
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

// Simple model to estimate closing line value
function estimateClv(currentOdds, hoursTillStart) {
  // Implementation details...
  return {
    currentOdds,
    currentImpliedProb: "0.54",
    projectedImpliedProb: "0.56",
    expectedClv: "2.00%"
  };
}

module.exports = {
  americanToDecimal,
  decimalToImpliedProbability,
  americanToImpliedProbability,
  calculateNoVigProbabilities,
  detectEdges,
  estimateClv
};
