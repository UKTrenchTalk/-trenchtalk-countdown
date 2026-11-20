import trendingService from "./trendingservice.js";

console.log("Starting Trending Service test...");

trendingService.subscribe((tokens) => {
  console.clear();

  console.log("========== TRENDING TOKENS ==========");
  console.log("Tokens found:", tokens.length);
  console.log("");

  if (tokens.length === 0) {
    console.log("Waiting for tokens with market data...");
    return;
  }

  tokens.forEach((token, index) => {
    console.log(`${index + 1}. ${token.name} (${token.symbol})`);
    console.log("Market Cap:", token.market?.marketCap);
    console.log("Price:", token.market?.priceUsd);
    console.log("24h Volume:", token.market?.volume24h);
    console.log("Trending Score:", token.trendingScore);
    console.log("-----------------------------------");
  });
});

trendingService.start();

process.on("SIGINT", () => {
  console.log("\nStopping test...");
  trendingService.stop();
  process.exit(0);
});