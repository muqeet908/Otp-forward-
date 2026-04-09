import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("🚀 IVASMS ULTRA BOT RUNNING");
});

export function keepAlive() {
  app.listen(3000, () =>
    console.log("KeepAlive Started")
  );
}
