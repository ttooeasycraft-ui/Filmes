const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Usuário e senha de admin — só quem souber isso consegue controlar o vídeo
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Jorge_Admin_87";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "cinema-secreto-2026";

// Estado atual do vídeo, guardado na memória do servidor
let state = {
  isPlaying: false,
  currentTime: 0,
  updatedAt: Date.now(),
  ended: false,
};

io.on("connection", (socket) => {
  socket.isAdmin = false;

  // Manda o estado atual pra quem acabou de entrar (ou recarregou a página),
  // já calculando quanto tempo passou, pra retomar no ponto certo
  function sendInit() {
    let estimatedTime = state.currentTime;
    if (state.isPlaying && !state.ended) {
      estimatedTime += (Date.now() - state.updatedAt) / 1000;
    }
    socket.emit("init", { ...state, currentTime: estimatedTime });
  }
  sendInit();

  socket.on("adminLogin", ({ username, password }) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      socket.isAdmin = true;
      socket.emit("adminLoginResult", { success: true });
    } else {
      socket.emit("adminLoginResult", { success: false });
    }
  });

  socket.on("playerEvent", (data) => {
    // Só aceita comando de quem fez login como admin. Ignora todo o resto.
    if (!socket.isAdmin) return;

    state.currentTime = data.time || 0;
    state.updatedAt = Date.now();

    if (data.type === "play") state.isPlaying = true;
    if (data.type === "pause") state.isPlaying = false;
    if (data.type === "ended") {
      state.isPlaying = false;
      state.ended = true;
    }

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
