const mint = "So11111111111111111111111111111111111111112";

const response = await fetch(
  `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`
);

const data = await response.json();

console.log("HTTP Status:", response.status);
console.log("Pairs returned:", data.length);
console.log("First pair:", data[0]);