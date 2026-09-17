const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Estado atual do vídeo, guardado na memória do servidor
let state = {
  isPlaying: false,
  currentTime: 0,
  updatedAt: Date.now(),
  ended: false,
};

io.on("connection", (socket) => {
  // Manda o estado atual pra quem acabou de entrar, já calculando quanto
  // tempo passou (se o vídeo estava tocando enquanto a pessoa entrava)
  let estimatedTime = state.currentTime;
  if (state.isPlaying && !state.ended) {
    estimatedTime += (Date.now() - state.updatedAt) / 1000;
  }
  socket.emit("init", { ...state, currentTime: estimatedTime });

  socket.on("playerEvent", (data) => {
    // data: { type: 'play' | 'pause' | 'seek' | 'ended', time }
    state.currentTime = data.time || 0;
    state.updatedAt = Date.now();

    if (data.type === "play") state.isPlaying = true;
    if (data.type === "pause") state.isPlaying = false;
    if (data.type === "ended") {
      state.isPlaying = false;
      state.ended = true;
    }

    // Repassa pra todo mundo, exceto quem mandou (ele já sabe)
    socket.broadcast.emit("sync", data);
  });

  socket.on("presenceJoin", () => {
    socket.broadcast.emit("presenceChanged");
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("presenceChanged");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
