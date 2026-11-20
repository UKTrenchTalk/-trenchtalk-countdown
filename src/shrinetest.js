import { io } from "socket.io-client";

const socket = io("https://sol.shrine.trade");

socket.on("connect", () => {
  console.log("Connected to Shrine!");
  
  socket.emit(
    "subscribe_new_tokens",
    {
      protocols: [
        "PUMPFUN",
        "PUMPSWAP",
        "METEORA",
        "RAYDIUM",
        "BONK",
        "STONKFUN"
      ]
    },
    (response) => {
      console.log("Subscription response:", response);
    }
  );
});

socket.on("new_token", (token) => {
  console.log("NEW TOKEN DETECTED");
  console.log("Name:", token.name);
  console.log("Symbol:", token.symbol);
  console.log("Protocol:", token.protocol);
  console.log("Address:", token.mint);
  console.log("------------------------");
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
});

socket.on("subscription_error", (error) => {
  console.error("Subscription error:", error);
});