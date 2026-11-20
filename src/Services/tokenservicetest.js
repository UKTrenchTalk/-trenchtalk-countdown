import tokenService from "./tokenservice.js";

console.log("Starting TrenchTalk Token Service...");

tokenService.subscribe(({ tokens, connected }) => {
  console.clear();

  console.log("Connected:", connected);
  console.log("Tokens received:", tokens.length);
  console.table(
    tokens.slice(0, 10).map((token) => ({
      name: token.name,
      symbol: token.symbol,
      protocol: token.protocol,
      mint: token.mint
    }))
  );
});

tokenService.connect();