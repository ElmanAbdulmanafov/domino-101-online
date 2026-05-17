import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = join(process.cwd(), "public");
const DATA_DIR = join(process.cwd(), "data");
const HISTORY_FILE = join(DATA_DIR, "game-history.json");
const TARGET_SCORES = {
  "101": 101,
  phone: 365
};
let firebaseProjectId = null;
let firebaseCredentialSource = null;
let firebaseError = null;
const historyDb = loadHistoryDb();
const firestore = initFirestore();
if (firestore) await hydrateHistoryFromFirestore();
const rooms = new Map();
const sockets = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      firebase: Boolean(firestore),
      firebaseProjectId,
      firebaseCredentialSource,
      firebaseError
    }));
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const content = await readFile(filePath);
  res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  res.end(content);
});

server.on("upgrade", (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }

  const accept = createHash("sha1")
    .update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const client = {
    id: randomId(),
    socket,
    name: "Oyuncu",
    playerId: null,
    roomCode: null,
    recvBuffer: Buffer.alloc(0),
    alive: true
  };

  sockets.add(client);
  send(client, { type: "connected", clientId: client.id });
  send(client, { type: "roomList", rooms: listOpenRooms() });

  socket.on("data", (chunk) => {
    client.recvBuffer = Buffer.concat([client.recvBuffer, chunk]);
    if (client.recvBuffer.length > 524288) {
      client.recvBuffer = Buffer.alloc(0);
      socket.destroy();
      return;
    }
    const { messages, consumed, close, pong } = decodeFrames(client.recvBuffer);
    if (consumed > 0) client.recvBuffer = client.recvBuffer.subarray(consumed);
    if (pong) client.alive = true;
    if (close) {
      if (!socket.destroyed) socket.write(Buffer.from([0x88, 0]));
      disconnect(client);
      return;
    }
    for (const message of messages) {
      handleMessage(client, message);
    }
  });

  socket.on("close", () => disconnect(client));
  socket.on("error", () => disconnect(client));
});

server.listen(PORT, HOST, () => {
  console.log(`Domino server: http://${HOST}:${PORT}`);
});

setInterval(() => {
  for (const client of sockets) {
    if (!client.alive) {
      client.socket.destroy();
      disconnect(client);
      continue;
    }
    client.alive = false;
    if (!client.socket.destroyed) {
      client.socket.write(Buffer.from([0x89, 0]));
    }
  }
}, 25000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.players.every((p) => !p.connected || p.bot)) {
      if (!room._lastActivity || now - room._lastActivity > 30 * 60 * 1000) {
        rooms.delete(code);
      }
    }
  }
  broadcastLobby();
}, 5 * 60 * 1000);

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, { type: "error", message: "Mesaj oxunmadi." });
    return;
  }

  if (message.type === "listRooms") {
    send(client, { type: "roomList", rooms: listOpenRooms() });
    return;
  }

  if (message.type === "getMyHistory") {
    send(client, { type: "myHistory", history: getPlayerHistory(client.playerId) });
    return;
  }

  if (message.type === "getLeaderboard") {
    send(client, { type: "leaderboard", leaderboard: getLeaderboard() });
    return;
  }

  if (message.type === "resumeSession") {
    const profile = resumeSession(message.token);
    if (!profile) {
      send(client, { type: "authRequired", message: "Sessiya bitib. Yeniden giris et." });
      return;
    }
    setClientProfile(client, profile);
    send(client, { type: "playerProfile", profile });
    return;
  }

  if (message.type === "createAccount") {
    const result = createAccount(message.profile);
    if (result.error) {
      send(client, { type: "authError", message: result.error });
      return;
    }
    setClientProfile(client, result.profile);
    send(client, { type: "playerProfile", profile: result.profile, sessionToken: result.sessionToken });
    return;
  }

  if (message.type === "loginAccount") {
    const result = loginAccount(message.credentials);
    if (result.error) {
      send(client, { type: "authError", message: result.error });
      return;
    }
    setClientProfile(client, result.profile);
    send(client, { type: "playerProfile", profile: result.profile, sessionToken: result.sessionToken });
    return;
  }

  if (message.type === "updateProfile") {
    if (!client.playerId) {
      send(client, { type: "authError", message: "Evvelce hesaba gir." });
      return;
    }
    const result = updateAccountProfile(client.playerId, message.profile);
    if (result.error) {
      send(client, { type: "authError", message: result.error });
      return;
    }
    setClientProfile(client, result.profile);
    send(client, { type: "playerProfile", profile: result.profile });
    return;
  }

  if (message.type === "registerPlayer") {
    const profile = registerPlayer(message.profile);
    setClientProfile(client, profile);
    send(client, { type: "playerProfile", profile });
    return;
  }

  if (message.type === "createRoom") {
    if (!client.playerId) {
      send(client, { type: "error", message: "Evvelce qeydiyyatdan kec." });
      return;
    }
    leaveRoom(client);
    client.name = cleanName(message.name || client.name);
    const code = newRoomCode();
    const mode = message.mode === "bot" ? "bot" : "online";
    const gameType = message.gameType === "phone" ? "phone" : "101";
    const room = {
      code,
      mode,
      gameType,
      roundNumber: 0,
      lastRoundWinnerId: null,
      players: [{ id: client.id, playerId: client.playerId, name: client.name, username: client.username, avatar: client.avatar, score: 0, connected: true, bot: false }],
      game: null,
      hostId: client.id,
      log: [],
      chat: []
    };

    if (mode === "bot") {
      const botCount = clampBotCount(message.botCount);
      const botNames = ["Bot Rauf", "Bot Leyla", "Bot Murad"];
      for (let i = 0; i < botCount; i += 1) {
        room.players.push({ id: `bot-${randomId(4)}`, name: botNames[i], score: 0, connected: true, bot: true });
      }
    }

    rooms.set(code, room);
    addLog(room, `${gameTitle(gameType)} otagi yaradildi.`);
    client.roomCode = code;
    broadcastRoom(room);
    broadcastLobby();
    maybeRunBot(room);
    return;
  }

  if (message.type === "joinRoom") {
    if (!client.playerId) {
      send(client, { type: "error", message: "Evvelce qeydiyyatdan kec." });
      return;
    }
    const code = String(message.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      send(client, { type: "error", message: "Bu kodla otaq tapilmadi." });
      return;
    }
    if (room.mode !== "online") {
      send(client, { type: "error", message: "Bu otaq bot oyunu ucundur." });
      return;
    }
    const sameProfileSeat = room.players.find((p) => p.playerId === client.playerId || p.replacedPlayerId === client.playerId);
    if (room.game && !sameProfileSeat) {
      send(client, { type: "error", message: "Bu otaqda oyun baslayib." });
      return;
    }
    if (room.players.length >= 4 && !room.players.some((p) => p.id === client.id) && !sameProfileSeat) {
      send(client, { type: "error", message: "Otaq doludur." });
      return;
    }

    leaveRoom(client);
    client.name = cleanName(message.name || client.name);
    const existing = sameProfileSeat || room.players.find((p) => p.id === client.id);
    if (existing) {
      const oldId = existing.id;
      existing.id = client.id;
      existing.playerId = client.playerId;
      existing.connected = true;
      existing.name = client.name;
      existing.username = client.username;
      existing.avatar = client.avatar;
      existing.bot = false;
      delete existing.replacedPlayerId;
      if (room.hostId === oldId) room.hostId = client.id;
      if (room.lastRoundWinnerId === oldId) room.lastRoundWinnerId = client.id;
      if (room.game?.hands?.[oldId] && oldId !== client.id) {
        room.game.hands[client.id] = room.game.hands[oldId];
        delete room.game.hands[oldId];
      }
      if (room.game?.turnPlayerId === oldId) room.game.turnPlayerId = client.id;
      addLog(room, `${client.name} yeniden otaga qayitdi.`);
    } else {
      room.players.push({ id: client.id, playerId: client.playerId, name: client.name, username: client.username, avatar: client.avatar, score: 0, connected: true, bot: false });
      addLog(room, `${client.name} qosuldu.`);
    }
    client.roomCode = code;
    broadcastRoom(room);
    broadcastLobby();
    return;
  }

  const room = rooms.get(client.roomCode);
  if (!room) {
    send(client, { type: "error", message: "Evvelce otaga qosul." });
    return;
  }

  if (message.type === "startGame") {
    if (room.hostId !== client.id) {
      send(client, { type: "error", message: "Oyunu yalniz otaq sahibi baslada biler." });
      return;
    }
    if (room.players.length < 2) {
      send(client, { type: "error", message: "Oyun ucun en azi 2 oyuncu lazimdir." });
      return;
    }
    startRound(room);
    broadcastRoom(room);
    broadcastLobby();
    maybeRunBot(room);
    return;
  }

  if (message.type === "playTile") {
    playTile(room, client.id, message.tileId, message.side);
    broadcastRoom(room);
    afterMove(room);
    return;
  }

  if (message.type === "passTurn") {
    passTurn(room, client.id);
    broadcastRoom(room);
    afterMove(room);
    return;
  }

  if (message.type === "restartMatch") {
    room.players = room.players.map((p) => ({ ...p, score: 0 }));
    startRound(room);
    broadcastRoom(room);
    maybeRunBot(room);
    return;
  }

  if (message.type === "sendChat") {
    addChat(room, client, message.text);
    broadcastRoom(room);
    return;
  }

  if (message.type === "leaveRoom") {
    replaceClientWithBot(room, client, "oyundan cixdi");
    client.roomCode = null;
    send(client, { type: "leftRoom" });
    broadcastRoom(room);
    broadcastLobby();
    maybeRunBot(room);
  }
}

function disconnect(client) {
  if (!sockets.has(client)) return;
  sockets.delete(client);
  const room = rooms.get(client.roomCode);
  if (room) {
    const player = room.players.find((p) => p.id === client.id);
    if (player) {
      player.connected = false;
      addLog(room, `${player.name} baglantini itirdi.`);
    }
    if (room.players.every((p) => !p.connected || p.bot)) {
      rooms.delete(room.code);
    } else {
      broadcastRoom(room);
    }
    broadcastLobby();
  }
}

function leaveRoom(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  const player = room.players.find((p) => p.id === client.id);
  if (player) player.connected = false;
  client.roomCode = null;
  broadcastRoom(room);
}

function replaceClientWithBot(room, client, reason) {
  const player = room.players.find((p) => p.id === client.id);
  if (!player) return;
  player.id = `bot-${randomId(4)}`;
  player.name = `Bot ${player.name}`.slice(0, 18);
  player.connected = true;
  player.bot = true;
  player.replacedPlayerId = client.playerId;
  delete player.playerId;

  if (room.hostId === client.id) {
    const nextHuman = room.players.find((p) => !p.bot && p.connected);
    room.hostId = nextHuman?.id || player.id;
  }

  if (room.lastRoundWinnerId === client.id) room.lastRoundWinnerId = player.id;
  if (room.game) {
    if (room.game.hands[client.id]) {
      room.game.hands[player.id] = room.game.hands[client.id];
      delete room.game.hands[client.id];
    }
    if (room.game.turnPlayerId === client.id) room.game.turnPlayerId = player.id;
  }

  addLog(room, `${client.name} ${reason}. Onu bot evezledi.`);
}

function startRound(room) {
  room.nextRoundTimer = null;
  room.roundNumber = (room.roundNumber || 0) + 1;
  const deck = shuffle(createDeck());
  const hands = {};
  const handSize = 7;

  for (const player of room.players) {
    hands[player.id] = deck.splice(0, handSize);
  }

  const opening = chooseOpening(room, hands);

  room.game = {
    board: [],
    left: null,
    right: null,
    boneyard: deck,
    hands,
    turnPlayerId: opening.playerId,
    requiredOpeningTileId: opening.tileId,
    passCount: 0,
    roundOver: false,
    matchOver: false,
    message: opening.message
  };
  addLog(room, `${gameTitle(room.gameType)} raundu basladi.`);
}

function chooseOpening(room, hands) {
  if (room.gameType === "phone") {
    if (room.roundNumber > 1 && room.lastRoundWinnerId) {
      return {
        playerId: room.lastRoundWinnerId,
        tileId: null,
        message: "Evvelki eli qazanan istediyi dasla baslayir."
      };
    }

    const threeTwo = findTileOwner(room, hands, (tile) => tile.a === 2 && tile.b === 3);
    if (threeTwo) {
      return {
        playerId: threeTwo.player.id,
        tileId: threeTwo.tile.id,
        message: `${threeTwo.player.name} 3:2 ile baslamalidir.`
      };
    }

    const lowestDouble = findLowestDoubleOwner(room, hands);
    if (lowestDouble) {
      return {
        playerId: lowestDouble.player.id,
        tileId: lowestDouble.tile.id,
        message: `${lowestDouble.player.name} en asagi qosa ${lowestDouble.tile.a}:${lowestDouble.tile.b} ile baslamalidir.`
      };
    }
  }

  let turnPlayerId = room.players[0].id;
  let bestDouble = -1;
  for (const player of room.players) {
    for (const tile of hands[player.id]) {
      if (tile.a === tile.b && tile.a > bestDouble) {
        bestDouble = tile.a;
        turnPlayerId = player.id;
      }
    }
  }
  return {
    playerId: turnPlayerId,
    tileId: null,
    message: `${gameTitle(room.gameType)} basladi.`
  };
}

function playTile(room, playerId, tileId, side) {
  const game = room.game;
  if (!game || game.roundOver || game.matchOver) return;
  if (game.turnPlayerId !== playerId) return;

  const hand = game.hands[playerId] || [];
  const index = hand.findIndex((tile) => tile.id === tileId);
  if (index === -1) return;

  const tile = hand[index];
  if (game.requiredOpeningTileId && game.board.length === 0 && tile.id !== game.requiredOpeningTileId) {
    send(findClient(playerId), { type: "error", message: "Bu elde baslama dasini qoymalisan." });
    return;
  }

  const move = normalizeMove(game, tile, side);
  if (!move) return;

  hand.splice(index, 1);
  game.requiredOpeningTileId = null;
  game.passCount = 0;
  game.left = move.left;
  game.right = move.right;

  if (move.side === "left") {
    game.board.unshift(move.tile);
  } else {
    game.board.push(move.tile);
  }

  const player = room.players.find((p) => p.id === playerId);
  addLog(room, `${player?.name || "Oyuncu"} ${tile.a}:${tile.b} qoydu.`);

  if (room.gameType === "phone") {
    const points = phoneScore(game);
    if (points > 0 && player) {
      player.score += points;
      game.message = `${player.name} ${points} xal yazdi.`;
      addLog(room, `${player.name}: +${points} Telefon xali.`);
      if (isMatchWinner(room, player)) {
        finishMatch(room, player);
        return;
      }
    } else {
      game.message = "Novbeti oyuncu oynayir.";
    }
  }

  if (hand.length === 0) {
    finishRound(room, playerId, "El bitdi.");
    return;
  }

  game.turnPlayerId = nextPlayer(room, playerId);
  if (room.gameType !== "phone" || !game.message.includes("xal yazdi")) {
    game.message = "Novbeti oyuncu oynayir.";
  }
}

function passTurn(room, playerId) {
  const game = room.game;
  if (!game || game.roundOver || game.matchOver) return;
  if (game.turnPlayerId !== playerId) return;

  const hand = game.hands[playerId] || [];
  const playable = hand.some((tile) => normalizeMove(game, tile, "left") || normalizeMove(game, tile, "right"));
  const player = room.players.find((p) => p.id === playerId);

  if (playable) {
    send(findClient(playerId), { type: "error", message: "Oynaya bileceyin das var." });
    return;
  }

  if (game.boneyard.length > 0) {
    const tile = game.boneyard.pop();
    hand.push(tile);
    const canPlayAfterDraw = normalizeMove(game, tile, "left") || normalizeMove(game, tile, "right");
    game.message = canPlayAfterDraw
      ? `${player?.name || "Oyuncu"} bazardan oynaya bileceyi das goturdu.`
      : `${player?.name || "Oyuncu"} bazardan das goturdu, yenede das yoxdur.`;
    addLog(room, `${player?.name || "Oyuncu"} bazardan das goturdu.`);
    if (!canPlayAfterDraw) {
      return;
    }
    return;
  } else {
    game.passCount += 1;
    game.message = `${player?.name || "Oyuncu"} kecdi.`;
    addLog(room, `${player?.name || "Oyuncu"} kecdi.`);
  }

  if (game.passCount >= room.players.length) {
    const winnerId = lowestHandPlayer(room);
    finishRound(room, winnerId, "Masa baglandi.");
    return;
  }

  game.turnPlayerId = nextPlayer(room, playerId);
}

function finishRound(room, winnerId, reason) {
  const game = room.game;
  const points = room.players.reduce((sum, player) => {
    if (player.id === winnerId) return sum;
    return sum + handValue(game.hands[player.id] || []);
  }, 0);

  const winner = room.players.find((p) => p.id === winnerId);
  if (winner && room.gameType === "101") winner.score += points;
  if (winner && room.gameType === "phone") {
    const rounded = roundUpToFive(points);
    winner.score += rounded;
    if (rounded > 0) {
      addLog(room, `${winner.name}: +${rounded} el sonu xali.`);
    }
  }
  if (winner) room.lastRoundWinnerId = winner.id;
  game.roundOver = true;
  if (winner && isMatchWinner(room, winner)) {
    finishMatch(room, winner);
    return;
  }
  game.message = room.gameType === "101"
    ? `${reason} ${winner?.name || "Oyuncu"} ${points} xal aldi. Novbeti el baslayir...`
    : `${reason} ${winner?.name || "Oyuncu"} ${roundUpToFive(points)} el sonu xali aldi. Novbeti el baslayir...`;
  addLog(room, game.message);
  scheduleNextRound(room);
}

function finishMatch(room, winner) {
  const game = room.game;
  game.roundOver = true;
  game.matchOver = true;
  const ranking = rankedPlayers(room).map((player, index) => `${index + 1}. ${player.name} ${player.score}`).join(" | ");
  game.message = `${winner.name} oyunu ${winner.score} xalla qazandi. Sira: ${ranking}`;
  addLog(room, game.message);
  saveMatch(room, winner);
}

function isMatchWinner(room, player) {
  return player.score >= targetScore(room.gameType);
}

function targetScore(gameType) {
  return TARGET_SCORES[gameType] || TARGET_SCORES["101"];
}

function scheduleNextRound(room) {
  if (room.nextRoundTimer || room.game?.matchOver) return;
  room.nextRoundTimer = setTimeout(() => {
    const latestRoom = rooms.get(room.code);
    if (!latestRoom || latestRoom.game?.matchOver) return;
    latestRoom.nextRoundTimer = null;
    startRound(latestRoom);
    broadcastRoom(latestRoom);
    maybeRunBot(latestRoom);
  }, 1800);
}

function afterMove(room) {
  if (room.game?.roundOver || room.game?.matchOver) return;
  maybeRunBot(room);
}

function rankedPlayers(room) {
  return [...room.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function setClientProfile(client, profile) {
  client.playerId = profile.id;
  client.name = profile.name;
  client.username = profile.username || "";
  client.avatar = profile.avatar || "";
}

function createAccount(rawProfile = {}) {
  const now = new Date().toISOString();
  const name = cleanName(rawProfile.name);
  const username = cleanUsername(rawProfile.username);
  const password = String(rawProfile.password || "");
  if (!name) return { error: "Ad yaz." };
  if (username.length < 3) return { error: "Istifadeci adi en azi 3 simvol olsun." };
  if (password.length < 4) return { error: "Parol en azi 4 simvol olsun." };
  if (findPlayerByUsername(username)) return { error: "Bu istifadeci adi artiq movcuddur." };

  const salt = randomId(16);
  const sessionToken = randomId(32);
  const account = {
    id: `player-${randomId(8)}`,
    name,
    username,
    avatar: cleanAvatar(rawProfile.avatar),
    passwordSalt: salt,
    passwordHash: passwordHash(password, salt),
    sessionHash: tokenHash(sessionToken),
    createdAt: now,
    updatedAt: now
  };

  historyDb.players = historyDb.players || {};
  historyDb.players[account.id] = account;
  saveHistoryDb();
  persistAccountToFirestore(account);
  persistPlayerToFirestore(publicProfile(account));
  return { profile: publicProfile(account), sessionToken };
}

function loginAccount(rawCredentials = {}) {
  const username = cleanUsername(rawCredentials.username);
  const password = String(rawCredentials.password || "");
  const account = findPlayerByUsername(username);
  if (!account || !account.passwordHash || passwordHash(password, account.passwordSalt) !== account.passwordHash) {
    return { error: "Istifadeci adi ve ya parol yanlisdir." };
  }

  const sessionToken = randomId(32);
  account.sessionHash = tokenHash(sessionToken);
  account.updatedAt = new Date().toISOString();
  saveHistoryDb();
  persistAccountToFirestore(account);
  persistPlayerToFirestore(publicProfile(account));
  return { profile: publicProfile(account), sessionToken };
}

function resumeSession(token) {
  const hash = tokenHash(token);
  if (!hash) return null;
  const account = Object.values(historyDb.players || {}).find((player) => player.sessionHash === hash);
  return account ? publicProfile(account) : null;
}

function updateAccountProfile(playerId, rawProfile = {}) {
  const account = historyDb.players?.[playerId];
  if (!account) return { error: "Hesab tapilmadi." };

  const name = cleanName(rawProfile.name);
  if (!name) return { error: "Ad bos ola bilmez." };

  const username = cleanUsername(rawProfile.username || account.username);
  if (username.length < 3) return { error: "Istifadeci adi en azi 3 simvol olsun." };
  const sameUsername = findPlayerByUsername(username);
  if (sameUsername && sameUsername.id !== account.id) return { error: "Bu istifadeci adi artiq movcuddur." };

  account.name = name;
  account.username = username;
  account.avatar = cleanAvatar(rawProfile.avatar);
  account.updatedAt = new Date().toISOString();
  saveHistoryDb();
  persistAccountToFirestore(account);
  persistPlayerToFirestore(publicProfile(account));
  return { profile: publicProfile(account) };
}

function registerPlayer(rawProfile = {}) {
  const now = new Date().toISOString();
  const existingId = String(rawProfile.id || "").trim();
  const profile = {
    id: existingId || `player-${randomId(8)}`,
    name: cleanName(rawProfile.name),
    username: cleanUsername(rawProfile.username),
    avatar: cleanAvatar(rawProfile.avatar),
    updatedAt: now
  };

  const previous = historyDb.players?.[profile.id];
  profile.createdAt = previous?.createdAt || now;
  historyDb.players = historyDb.players || {};
  historyDb.players[profile.id] = { ...previous, ...profile };
  saveHistoryDb();
  persistPlayerToFirestore(publicProfile(historyDb.players[profile.id]));
  return publicProfile(historyDb.players[profile.id]);
}

function getPlayerHistory(playerId) {
  if (!playerId) return { matches: [], rooms: [], stats: defaultStats() };

  const matches = (historyDb.matches || [])
    .filter((match) => match.ranking?.some((player) => player.playerId === playerId || player.id === playerId))
    .slice(0, 20);

  const rooms = Object.values(historyDb.rooms || {})
    .filter((room) => room.players?.some((player) => player.playerId === playerId || player.id === playerId))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 20)
    .map((room) => ({
      code: room.code,
      mode: room.mode,
      gameType: room.gameType,
      updatedAt: room.updatedAt,
      roundNumber: room.roundNumber,
      players: room.players,
      events: (room.events || []).slice(0, 12)
    }));

  return { matches, rooms, stats: getPlayerStats(playerId) };
}

function getPlayerStats(playerId) {
  const allMatches = (historyDb.matches || [])
    .filter((match) => match.ranking?.some((player) => player.playerId === playerId || player.id === playerId));
  const stats = defaultStats();
  for (const match of allMatches) {
    const me = match.ranking?.find((player) => player.playerId === playerId || player.id === playerId);
    if (!me) continue;
    stats.games += 1;
    if (match.gameType === "phone") stats.phoneGames += 1;
    else stats.games101 += 1;
    if (match.winner?.playerId === playerId || match.winner?.id === playerId) stats.wins += 1;
    stats.points += Number(me.score || 0);
    stats.bestScore = Math.max(stats.bestScore, Number(me.score || 0));
    stats.lastPlayedAt = stats.lastPlayedAt || match.finishedAt || null;
  }
  stats.winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  return stats;
}

function getLeaderboard() {
  const players = Object.values(historyDb.players || {})
    .filter((player) => player.id && !player.bot)
    .map((player) => {
      const stats = getPlayerStats(player.id);
      return {
        id: player.id,
        name: player.name || "Oyuncu",
        username: player.username || "",
        avatar: player.avatar || "",
        stats
      };
    })
    .filter((player) => player.stats.games > 0 || player.username)
    .sort((a, b) => {
      if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
      if (b.stats.winRate !== a.stats.winRate) return b.stats.winRate - a.stats.winRate;
      if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 25);

  return {
    byWins: players.slice(0, 10),
    byPoints: [...players].sort((a, b) => b.stats.points - a.stats.points || b.stats.wins - a.stats.wins).slice(0, 10),
    byGames: [...players].sort((a, b) => b.stats.games - a.stats.games || b.stats.wins - a.stats.wins).slice(0, 10)
  };
}

function defaultStats() {
  return { games: 0, wins: 0, winRate: 0, points: 0, bestScore: 0, games101: 0, phoneGames: 0, lastPlayedAt: null };
}

function publicProfile(account = {}) {
  return {
    id: account.id,
    name: account.name,
    username: account.username,
    avatar: account.avatar || "",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    stats: getPlayerStats(account.id)
  };
}

function findPlayerByUsername(username) {
  const clean = cleanUsername(username).toLowerCase();
  if (!clean) return null;
  return Object.values(historyDb.players || {}).find((player) => cleanUsername(player.username).toLowerCase() === clean) || null;
}

function cleanUsername(username) {
  return String(username || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 24);
}

function cleanAvatar(avatar) {
  const value = String(avatar || "");
  if (!value.startsWith("data:image/")) return "";
  return value.length <= 120000 ? value : "";
}

function passwordHash(password, salt) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function tokenHash(token) {
  const value = String(token || "");
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function loadHistoryDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(HISTORY_FILE)) {
    return { version: 1, rooms: {}, players: {}, matches: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
    return {
      version: 1,
      rooms: parsed.rooms || {},
      players: parsed.players || {},
      matches: Array.isArray(parsed.matches) ? parsed.matches : []
    };
  } catch {
    return { version: 1, rooms: {}, players: {}, matches: [] };
  }
}

function initFirestore() {
  const serviceAccount = loadFirebaseServiceAccount();
  if (!serviceAccount) {
    firebaseError ||= "Firebase service account env not found";
    console.log("Firebase disabled: using local JSON history fallback.");
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
    firebaseProjectId = serviceAccount.project_id || null;
    firebaseError = null;
    console.log(`Firebase enabled: ${serviceAccount.project_id}`);
    return getFirestore();
  } catch (error) {
    firebaseError = error.message;
    console.warn(`Firebase init failed: ${error.message}`);
    return null;
  }
}

function loadFirebaseServiceAccount() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      firebaseCredentialSource = "FIREBASE_SERVICE_ACCOUNT_BASE64";
      const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim().replace(/\s/g, "");
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      return JSON.parse(decoded);
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      firebaseCredentialSource = "FIREBASE_SERVICE_ACCOUNT";
      const normalized = process.env.FIREBASE_SERVICE_ACCOUNT.trim().replace(/\\n/g, "\n");
      return JSON.parse(normalized);
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      firebaseCredentialSource = "FIREBASE_SERVICE_ACCOUNT_PATH";
      return JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
    }
  } catch (error) {
    firebaseError = error.message;
    console.warn(`Firebase credential parse failed: ${error.message}`);
  }

  firebaseCredentialSource = null;
  return null;
}

async function hydrateHistoryFromFirestore() {
  try {
    const [accountSnapshot, matchSnapshot] = await Promise.all([
      firestore.collection("accounts").get(),
      firestore.collection("matches").limit(1000).get()
    ]);

    historyDb.players = historyDb.players || {};
    accountSnapshot.forEach((doc) => {
      const account = doc.data();
      if (account?.id) historyDb.players[account.id] = { ...historyDb.players[account.id], ...account };
    });

    const firestoreMatches = [];
    matchSnapshot.forEach((doc) => firestoreMatches.push(doc.data()));
    if (firestoreMatches.length) {
      const byKey = new Map((historyDb.matches || []).map((match) => [matchKey(match), match]));
      for (const match of firestoreMatches) byKey.set(matchKey(match), match);
      historyDb.matches = [...byKey.values()]
        .sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")))
        .slice(0, 1000);
    }

    saveHistoryDb();
  } catch (error) {
    console.warn(`Firestore hydrate failed: ${error.message}`);
  }
}

function matchKey(match) {
  return `${match.roomCode || "room"}:${match.finishedAt || ""}:${match.winner?.playerId || match.winner?.id || ""}`;
}

let _saveTimer = null;
function saveHistoryDb() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(HISTORY_FILE, JSON.stringify(historyDb, null, 2));
  }, 2000);
}

process.on("exit", () => {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(HISTORY_FILE, JSON.stringify(historyDb, null, 2));
  }
});

function addLog(room, message) {
  room._lastActivity = Date.now();
  const entry = {
    at: new Date().toISOString(),
    roundNumber: room.roundNumber || 0,
    message
  };

  room.log.unshift(message);
  room.log = room.log.slice(0, 100);

  const storedRoom = historyDb.rooms[room.code] || {
    code: room.code,
    mode: room.mode,
    gameType: room.gameType,
    createdAt: entry.at,
    players: [],
    events: []
  };

  storedRoom.mode = room.mode;
  storedRoom.gameType = room.gameType;
  storedRoom.updatedAt = entry.at;
  storedRoom.roundNumber = room.roundNumber || 0;
  storedRoom.players = room.players.map((player) => ({
    id: player.id,
    playerId: player.playerId || player.replacedPlayerId || null,
    name: player.name,
    username: player.username || "",
    avatar: player.avatar || "",
    score: player.score,
    bot: player.bot
  }));
  storedRoom.events.unshift(entry);
  storedRoom.events = storedRoom.events.slice(0, 500);
  historyDb.rooms[room.code] = storedRoom;
  saveHistoryDb();
  persistLogToFirestore(room, entry, storedRoom);
}

function addChat(room, client, text) {
  const cleanText = cleanChatText(text);
  if (!cleanText) return;
  room._lastActivity = Date.now();
  room.chat = room.chat || [];
  room.chat.push({
    id: randomId(8),
    at: new Date().toISOString(),
    playerId: client.playerId,
    clientId: client.id,
    name: client.name,
    text: cleanText
  });
  room.chat = room.chat.slice(-50);
}

function saveMatch(room, winner) {
  const finishedAt = new Date().toISOString();
  const match = {
    roomCode: room.code,
    mode: room.mode,
    gameType: room.gameType,
    finishedAt,
    winner: {
      id: winner.id,
      playerId: winner.playerId || winner.replacedPlayerId || null,
      name: winner.name,
      score: winner.score
    },
    ranking: rankedPlayers(room).map((player, index) => ({
      place: index + 1,
      id: player.id,
      playerId: player.playerId || player.replacedPlayerId || null,
      name: player.name,
      username: player.username || "",
      avatar: player.avatar || "",
      score: player.score,
      bot: player.bot
    }))
  };
  historyDb.matches.unshift(match);
  historyDb.matches = historyDb.matches.slice(0, 1000);
  saveHistoryDb();
  persistMatchToFirestore(match);
  for (const player of room.players) {
    const playerId = player.playerId || player.replacedPlayerId;
    const account = historyDb.players?.[playerId];
    if (account) persistPlayerToFirestore(publicProfile(account));
  }
}

function persistLogToFirestore(room, entry, storedRoom) {
  if (!firestore) return;

  const roomRef = firestore.collection("rooms").doc(room.code);
  roomRef.set({
    code: room.code,
    mode: room.mode,
    gameType: room.gameType,
    hostId: room.hostId,
    roundNumber: room.roundNumber || 0,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: storedRoom.createdAt,
    players: storedRoom.players,
    recentEvents: storedRoom.events.slice(0, 50)
  }, { merge: true }).catch((error) => {
    console.warn(`Firestore room write failed: ${error.message}`);
  });

  roomRef.collection("events").add({
    ...entry,
    createdAt: FieldValue.serverTimestamp()
  }).catch((error) => {
    console.warn(`Firestore event write failed: ${error.message}`);
  });
}

function persistMatchToFirestore(match) {
  if (!firestore) return;

  firestore.collection("matches").add({
    ...match,
    createdAt: FieldValue.serverTimestamp()
  }).catch((error) => {
    console.warn(`Firestore match write failed: ${error.message}`);
  });
}

function persistPlayerToFirestore(profile) {
  if (!firestore) return;

  firestore.collection("players").doc(profile.id).set({
    ...profile,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch((error) => {
    console.warn(`Firestore player write failed: ${error.message}`);
  });
}

function persistAccountToFirestore(account) {
  if (!firestore || !account?.id) return;

  firestore.collection("accounts").doc(account.id).set({
    id: account.id,
    name: account.name,
    username: account.username,
    avatar: account.avatar || "",
    passwordSalt: account.passwordSalt || "",
    passwordHash: account.passwordHash || "",
    sessionHash: account.sessionHash || "",
    createdAt: account.createdAt || null,
    updatedAt: account.updatedAt || null,
    savedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch((error) => {
    console.warn(`Firestore account write failed: ${error.message}`);
  });
}

function normalizeMove(game, tile, side) {
  if (game.board.length === 0) {
    return { side: "right", tile: boardTile(tile, tile.a, tile.b), left: tile.a, right: tile.b };
  }

  if (side === "left") {
    if (tile.a === game.left) return { side, tile: boardTile(tile, tile.b, tile.a), left: tile.b, right: game.right };
    if (tile.b === game.left) return { side, tile: boardTile(tile, tile.a, tile.b), left: tile.a, right: game.right };
  }

  if (side === "right") {
    if (tile.a === game.right) return { side, tile: boardTile(tile, tile.a, tile.b), left: game.left, right: tile.b };
    if (tile.b === game.right) return { side, tile: boardTile(tile, tile.b, tile.a), left: game.left, right: tile.a };
  }

  return null;
}

function boardTile(tile, left, right) {
  return { ...tile, left, right, double: tile.a === tile.b };
}

function nextPlayer(room, playerId) {
  const players = room.players;
  const index = players.findIndex((p) => p.id === playerId);
  return players[(index + 1) % players.length].id;
}

function lowestHandPlayer(room) {
  return room.players
    .map((player) => ({ id: player.id, value: handValue(room.game.hands[player.id] || []) }))
    .sort((a, b) => a.value - b.value)[0].id;
}

function handValue(hand) {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

function roundUpToFive(value) {
  if (value <= 0) return 0;
  return Math.ceil(value / 5) * 5;
}

function clampBotCount(value) {
  const count = Number(value || 1);
  return Math.min(3, Math.max(1, Number.isFinite(count) ? Math.trunc(count) : 1));
}

function findTileOwner(room, hands, predicate) {
  for (const player of room.players) {
    const tile = hands[player.id].find(predicate);
    if (tile) return { player, tile };
  }
  return null;
}

function findLowestDoubleOwner(room, hands) {
  return room.players
    .flatMap((player) => hands[player.id]
      .filter((tile) => tile.a === tile.b)
      .map((tile) => ({ player, tile })))
    .sort((a, b) => a.tile.a - b.tile.a)[0] || null;
}

function phoneScore(game) {
  if (!game.board.length) return 0;
  if (game.board.length === 1) {
    const only = game.board[0];
    const total = only.left + only.right;
    return total > 0 && total % 5 === 0 ? total : 0;
  }

  const leftTile = game.board[0];
  const rightTile = game.board[game.board.length - 1];
  const leftValue = leftTile.double ? Number(game.left || 0) * 2 : Number(game.left || 0);
  const rightValue = rightTile.double ? Number(game.right || 0) * 2 : Number(game.right || 0);
  const total = leftValue + rightValue;
  return total > 0 && total % 5 === 0 ? total : 0;
}

function maybeRunBot(room) {
  const game = room.game;
  if (!game || game.roundOver || game.matchOver) return;
  const player = room.players.find((p) => p.id === game.turnPlayerId);
  if (!player?.bot) return;

  setTimeout(() => {
    const latestRoom = rooms.get(room.code);
    const latestGame = latestRoom?.game;
    if (!latestGame || latestGame.turnPlayerId !== player.id || latestGame.roundOver) return;
    const hand = latestGame.hands[player.id] || [];
    const move = findBotMove(latestGame, hand);
    if (move) {
      playTile(latestRoom, player.id, move.tile.id, move.side);
    } else {
      passTurn(latestRoom, player.id);
    }
    broadcastRoom(latestRoom);
    maybeRunBot(latestRoom);
  }, 650);
}

function findBotMove(game, hand) {
  if (game.requiredOpeningTileId && game.board.length === 0) {
    const tile = hand.find((item) => item.id === game.requiredOpeningTileId);
    return tile ? { tile, side: "right" } : null;
  }

  const moves = [];
  for (const tile of hand) {
    if (normalizeMove(game, tile, "left")) moves.push({ tile, side: "left" });
    if (normalizeMove(game, tile, "right")) moves.push({ tile, side: "right" });
  }
  if (!moves.length) return null;

  moves.sort((a, b) => {
    const aDouble = a.tile.a === a.tile.b ? 1 : 0;
    const bDouble = b.tile.a === b.tile.b ? 1 : 0;
    if (aDouble !== bDouble) return bDouble - aDouble;
    return (b.tile.a + b.tile.b) - (a.tile.a + a.tile.b);
  });
  return moves[0];
}

function createDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      deck.push({ id: `${a}-${b}-${randomId(4)}`, a, b });
    }
  }
  return deck;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function broadcastRoom(room) {
  for (const client of sockets) {
    if (client.roomCode === room.code) {
      send(client, {
        type: "roomState",
        room: serializeRoom(room, client.id)
      });
    }
  }
}

function broadcastLobby() {
  const payload = { type: "roomList", rooms: listOpenRooms() };
  for (const client of sockets) {
    if (!client.roomCode) send(client, payload);
  }
}

function listOpenRooms() {
  return [...rooms.values()]
    .filter((room) => room.mode === "online" && !room.game && room.players.some((p) => p.connected))
    .map((room) => ({
      code: room.code,
      gameType: room.gameType,
      players: room.players.filter((p) => p.connected).length,
      maxPlayers: 4,
      hostName: room.players.find((p) => p.id === room.hostId)?.name || "Oyuncu"
    }));
}

function serializeRoom(room, viewerId) {
  const game = room.game;
  return {
    code: room.code,
    mode: room.mode,
    gameType: room.gameType,
    targetScore: targetScore(room.gameType),
    roundNumber: room.roundNumber || 0,
    ranking: rankedPlayers(room).map((player, index) => ({
      id: player.id,
      playerId: player.playerId || player.replacedPlayerId || null,
      name: player.name,
      username: player.username || "",
      avatar: player.avatar || "",
      score: player.score,
      place: index + 1
    })),
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
      playerId: player.playerId || player.replacedPlayerId || null,
      name: player.name,
      username: player.username || "",
      avatar: player.avatar || "",
      score: player.score,
      connected: player.connected,
      bot: player.bot,
      tileCount: game ? game.hands[player.id]?.length || 0 : 0
    })),
    game: game
      ? {
          board: game.board,
          left: game.left,
          right: game.right,
          boneyardCount: game.boneyard.length,
          hand: game.hands[viewerId] || [],
          turnPlayerId: game.turnPlayerId,
          requiredOpeningTileId: game.requiredOpeningTileId,
          roundOver: game.roundOver,
          matchOver: game.matchOver,
          message: game.message
        }
      : null,
    log: room.log.slice(0, 50),
    chat: (room.chat || []).slice(-50)
  };
}

function send(client, payload) {
  if (!client?.socket || client.socket.destroyed) return;
  const data = Buffer.from(JSON.stringify(payload));
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x81, data.length]);
  } else if (data.length <= 65535) {
    header = Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  client.socket.write(Buffer.concat([header, data]));
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  let close = false;
  let pong = false;

  while (offset + 2 <= buffer.length) {
    const frameStart = offset;
    const opcode = buffer[offset] & 0x0f;
    let length = buffer[offset + 1] & 0x7f;
    const masked = Boolean(buffer[offset + 1] & 0x80);
    offset += 2;

    if (length === 126) {
      if (offset + 2 > buffer.length) { offset = frameStart; break; }
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) { offset = frameStart; break; }
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    const maskSize = masked ? 4 : 0;
    if (offset + maskSize + length > buffer.length) { offset = frameStart; break; }

    if (length > 524288) { offset += maskSize + length; continue; }

    const mask = masked ? buffer.subarray(offset, offset + 4) : null;
    if (masked) offset += 4;

    const payload = buffer.subarray(offset, offset + length);
    offset += length;

    if (opcode === 0x8) { close = true; break; }
    if (opcode === 0xa) { pong = true; continue; }
    if (opcode !== 0x1) continue;

    const decoded = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) {
      decoded[i] = mask ? payload[i] ^ mask[i % 4] : payload[i];
    }
    messages.push(decoded.toString("utf8"));
  }

  return { messages, consumed: offset, close, pong };
}

function findClient(id) {
  return [...sockets].find((client) => client.id === id);
}

function cleanName(name) {
  const text = String(name || "").trim().replace(/[<>"&]/g, "");
  return text ? text.slice(0, 18) : "Oyuncu";
}

function cleanChatText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>"&]/g, "")
    .slice(0, 180);
}

function gameTitle(gameType) {
  return gameType === "phone" ? "Telefon" : "101";
}

function newRoomCode() {
  let code;
  do {
    code = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function randomId(size = 8) {
  return randomBytes(size).toString("hex");
}
