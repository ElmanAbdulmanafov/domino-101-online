const DEFAULT_SERVER_HOST = "domino-101-online.onrender.com";
const SERVER_STORAGE_VERSION = "render-v1";

const state = {
  clientId: null,
  profile: loadSavedProfile(),
  myHistory: { matches: [], rooms: [] },
  room: null,
  rooms: [],
  selectedTileId: null,
  authMode: "login",
  mode: "online",
  gameType: "101",
  botCount: 1,
  soundEnabled: localStorage.getItem("domino101Sound") !== "off",
  lastSoundSnapshot: null,
  ws: null
};

const els = {
  connection: document.querySelector("#connection"),
  auth: document.querySelector("#auth"),
  setup: document.querySelector("#setup"),
  room: document.querySelector("#room"),
  authLoginButton: document.querySelector("#authLoginButton"),
  authCreateButton: document.querySelector("#authCreateButton"),
  registerNameInput: document.querySelector("#registerNameInput"),
  registerUsernameInput: document.querySelector("#registerUsernameInput"),
  registerPasswordInput: document.querySelector("#registerPasswordInput"),
  avatarInput: document.querySelector("#avatarInput"),
  avatarPreview: document.querySelector("#avatarPreview"),
  registerButton: document.querySelector("#registerButton"),
  authError: document.querySelector("#authError"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileStats: document.querySelector("#profileStats"),
  profileNameInput: document.querySelector("#profileNameInput"),
  profileUsernameInput: document.querySelector("#profileUsernameInput"),
  profileAvatarInput: document.querySelector("#profileAvatarInput"),
  profileAvatarPreview: document.querySelector("#profileAvatarPreview"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  soundToggleButton: document.querySelector("#soundToggleButton"),
  logoutButton: document.querySelector("#logoutButton"),
  nameInput: document.querySelector("#nameInput"),
  serverInput: document.querySelector("#serverInput"),
  roomInput: document.querySelector("#roomInput"),
  createRoomButton: document.querySelector("#createRoomButton"),
  joinRoomButton: document.querySelector("#joinRoomButton"),
  refreshRoomsButton: document.querySelector("#refreshRoomsButton"),
  refreshHistoryButton: document.querySelector("#refreshHistoryButton"),
  profileHistory: document.querySelector("#profileHistory"),
  roomList: document.querySelector("#roomList"),
  lobby: document.querySelector("#lobby"),
  joinByCode: document.querySelector("#joinByCode"),
  game101Button: document.querySelector("#game101Button"),
  gamePhoneButton: document.querySelector("#gamePhoneButton"),
  onlineModeButton: document.querySelector("#onlineModeButton"),
  botModeButton: document.querySelector("#botModeButton"),
  botCountWrap: document.querySelector("#botCountWrap"),
  botOneButton: document.querySelector("#botOneButton"),
  botTwoButton: document.querySelector("#botTwoButton"),
  botThreeButton: document.querySelector("#botThreeButton"),
  copyCodeButton: document.querySelector("#copyCodeButton"),
  inviteButton: document.querySelector("#inviteButton"),
  roomMeta: document.querySelector("#roomMeta"),
  roundBadge: document.querySelector("#roundBadge"),
  leaveRoomButton: document.querySelector("#leaveRoomButton"),
  startButton: document.querySelector("#startButton"),
  seatTop: document.querySelector("#seatTop"),
  seatLeft: document.querySelector("#seatLeft"),
  seatRight: document.querySelector("#seatRight"),
  seatBottom: document.querySelector("#seatBottom"),
  message: document.querySelector("#message"),
  board: document.querySelector("#board"),
  hand: document.querySelector("#hand"),
  scoreTarget: document.querySelector("#scoreTarget"),
  scoreboard: document.querySelector("#scoreboard"),
  chatCount: document.querySelector("#chatCount"),
  chatList: document.querySelector("#chatList"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatSendButton: document.querySelector("#chatSendButton"),
  log: document.querySelector("#log"),
  error: document.querySelector("#error"),
  playLeftButton: document.querySelector("#playLeftButton"),
  playRightButton: document.querySelector("#playRightButton"),
  passButton: document.querySelector("#passButton")
};

els.serverInput.value = savedServerAddress();
bindControls();
connect();
renderSetup();

let resizeTimer = null;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderBoard(state.room?.game), 120);
});

function bindControls() {
  els.authLoginButton.addEventListener("click", () => setAuthMode("login"));
  els.authCreateButton.addEventListener("click", () => setAuthMode("create"));
  els.registerButton.addEventListener("click", registerFromForm);
  els.logoutButton.addEventListener("click", () => {
    localStorage.removeItem("domino101Profile");
    localStorage.removeItem("domino101SessionToken");
    state.profile = null;
    state.myHistory = { matches: [], rooms: [], stats: null };
    renderAuth();
  });
  els.avatarInput.addEventListener("change", () => readAvatar(els.avatarInput, els.avatarPreview));
  els.profileAvatarInput.addEventListener("change", () => readAvatar(els.profileAvatarInput, els.profileAvatarPreview));
  els.saveProfileButton.addEventListener("click", updateProfileFromForm);

  els.soundToggleButton.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem("domino101Sound", state.soundEnabled ? "on" : "off");
    updateSoundButton();
    if (state.soundEnabled) playSound("click");
  });

  els.serverInput.addEventListener("change", () => {
    localStorage.setItem("domino101Server", normalizeServerAddress(els.serverInput.value));
    localStorage.setItem("domino101ServerVersion", SERVER_STORAGE_VERSION);
    state.ws?.close();
  });

  els.game101Button.addEventListener("click", () => setGameType("101"));
  els.gamePhoneButton.addEventListener("click", () => setGameType("phone"));
  els.onlineModeButton.addEventListener("click", () => setMode("online"));
  els.botModeButton.addEventListener("click", () => setMode("bot"));
  els.botOneButton.addEventListener("click", () => setBotCount(1));
  els.botTwoButton.addEventListener("click", () => setBotCount(2));
  els.botThreeButton.addEventListener("click", () => setBotCount(3));

  els.createRoomButton.addEventListener("click", () => {
    if (!requireProfile()) return;
    send({ type: "createRoom", name: playerName(), mode: state.mode, gameType: state.gameType, botCount: state.botCount });
  });

  els.joinRoomButton.addEventListener("click", () => {
    if (!requireProfile()) return;
    send({ type: "joinRoom", name: playerName(), code: els.roomInput.value });
  });

  els.refreshRoomsButton.addEventListener("click", () => send({ type: "listRooms" }));
  els.refreshHistoryButton.addEventListener("click", () => send({ type: "getMyHistory" }));

  els.startButton.addEventListener("click", () => {
    if (state.room?.game?.matchOver) {
      send({ type: "restartMatch" });
      return;
    }
    send({ type: "startGame" });
  });

  els.leaveRoomButton.addEventListener("click", () => {
    send({ type: "leaveRoom" });
  });

  els.copyCodeButton.addEventListener("click", async () => {
    if (!state.room?.code) return;
    await navigator.clipboard?.writeText(state.room.code);
    flash(`Kod kopyalandi: ${state.room.code}`);
  });
  els.inviteButton.addEventListener("click", inviteToRoom);
  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.chatInput.value.trim();
    if (!text) return;
    send({ type: "sendChat", text });
    els.chatInput.value = "";
  });

  els.playLeftButton.addEventListener("click", () => playSelected("left"));
  els.playRightButton.addEventListener("click", () => playSelected("right"));
  els.passButton.addEventListener("click", () => send({ type: "passTurn" }));
}

function connect() {
  const address = normalizeServerAddress(els.serverInput.value);
  localStorage.setItem("domino101Server", address);
  localStorage.setItem("domino101ServerVersion", SERVER_STORAGE_VERSION);
  const ws = new WebSocket(address);
  state.ws = ws;

  ws.addEventListener("open", () => {
    els.connection.textContent = "Online";
    const sessionToken = localStorage.getItem("domino101SessionToken");
    if (sessionToken) send({ type: "resumeSession", token: sessionToken });
    send({ type: "listRooms" });
  });

  ws.addEventListener("close", () => {
    els.connection.textContent = "Offline";
    window.setTimeout(connect, 1200);
  });

  ws.addEventListener("error", () => {
    els.connection.textContent = "Offline";
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "connected") {
      state.clientId = message.clientId;
    }
    if (message.type === "playerProfile") {
      state.profile = message.profile;
      if (message.sessionToken) localStorage.setItem("domino101SessionToken", message.sessionToken);
      localStorage.setItem("domino101Profile", JSON.stringify(message.profile));
      els.nameInput.value = message.profile.name;
      els.authError.textContent = "";
      renderAuth();
      send({ type: "getMyHistory" });
    }
    if (message.type === "authError") {
      els.authError.textContent = message.message;
      if (!state.profile?.id) {
        localStorage.removeItem("domino101Profile");
        localStorage.removeItem("domino101SessionToken");
      } else {
        flash(message.message);
      }
      renderAuth();
    }
    if (message.type === "authRequired") {
      els.authError.textContent = message.message || "";
      state.profile = null;
      localStorage.removeItem("domino101Profile");
      localStorage.removeItem("domino101SessionToken");
      renderAuth();
    }
    if (message.type === "myHistory") {
      state.myHistory = message.history;
      renderProfileHistory();
    }
    if (message.type === "leftRoom") {
      playSound("leave");
      state.room = null;
      state.selectedTileId = null;
      document.body.classList.remove("in-room");
      renderSetup();
      els.room.classList.add("hidden");
      send({ type: "getMyHistory" });
    }
    if (message.type === "roomList") {
      state.rooms = message.rooms;
      renderRoomList();
    }
    if (message.type === "roomState") {
      playRoomSounds(message.room);
      state.room = message.room;
      state.selectedTileId = null;
      render();
    }
    if (message.type === "error") {
      flash(message.message);
    }
  });
}

function send(payload) {
  if (state.ws?.readyState !== WebSocket.OPEN) {
    flash("Servere baglanti yoxdur.");
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

function setMode(mode) {
  state.mode = mode;
  renderSetup();
}

function setGameType(gameType) {
  state.gameType = gameType;
  renderSetup();
}

function setBotCount(count) {
  state.botCount = count;
  renderSetup();
}

function renderSetup() {
  renderAuth();
  updateSoundButton();
  els.game101Button.classList.toggle("active", state.gameType === "101");
  els.gamePhoneButton.classList.toggle("active", state.gameType === "phone");
  els.onlineModeButton.classList.toggle("active", state.mode === "online");
  els.botModeButton.classList.toggle("active", state.mode === "bot");
  els.botOneButton.classList.toggle("active", state.botCount === 1);
  els.botTwoButton.classList.toggle("active", state.botCount === 2);
  els.botThreeButton.classList.toggle("active", state.botCount === 3);
  els.botCountWrap.hidden = state.mode !== "bot";
  els.lobby.hidden = state.mode !== "online";
  els.joinByCode.hidden = state.mode !== "online";
  els.createRoomButton.textContent = state.mode === "bot" ? "Botla basla" : "Otaq yarat";
  renderProfileHistory();
}

function updateSoundButton() {
  if (!els.soundToggleButton) return;
  els.soundToggleButton.textContent = state.soundEnabled ? "Ses: aciq" : "Ses: bagli";
}

function renderAuth() {
  const registered = Boolean(state.profile?.id);
  els.auth.classList.toggle("hidden", registered);
  els.setup.classList.toggle("hidden", !registered || Boolean(state.room));
  els.authLoginButton.classList.toggle("active", state.authMode === "login");
  els.authCreateButton.classList.toggle("active", state.authMode === "create");
  els.registerButton.textContent = state.authMode === "login" ? "Giris et" : "Hesab yarat";
  els.registerPasswordInput.autocomplete = state.authMode === "login" ? "current-password" : "new-password";
  for (const item of els.auth.querySelectorAll(".create-only")) item.hidden = state.authMode !== "create";
  if (registered) {
    els.profileName.textContent = `${state.profile.name}${state.profile.username ? ` (@${state.profile.username})` : ""}`;
    els.nameInput.value ||= state.profile.name;
    els.profileNameInput.value = state.profile.name || "";
    els.profileUsernameInput.value = state.profile.username || "";
    renderAvatar(els.profileAvatar, state.profile);
    renderAvatar(els.profileAvatarPreview, state.profile);
    renderProfileStats();
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  els.authError.textContent = "";
  renderAuth();
}

function registerFromForm() {
  const username = els.registerUsernameInput.value.trim();
  const password = els.registerPasswordInput.value;

  if (!username || !password) {
    els.authError.textContent = "Istifadeci adi ve parol yaz.";
    return;
  }

  els.authError.textContent = "";
  if (state.authMode === "login") {
    send({ type: "loginAccount", credentials: { username, password } });
    return;
  }

  const profile = {
    name: els.registerNameInput.value.trim(),
    username,
    password,
    avatar: els.avatarPreview.dataset.avatar || ""
  };
  if (!profile.name) {
    els.authError.textContent = "Ad soyad yaz.";
    return;
  }
  send({ type: "createAccount", profile });
}

function updateProfileFromForm() {
  const profile = {
    name: els.profileNameInput.value.trim(),
    username: els.profileUsernameInput.value.trim(),
    avatar: els.profileAvatarPreview.dataset.avatar || state.profile?.avatar || ""
  };
  if (!profile.name || !profile.username) {
    flash("Ad ve istifadeci adi bos ola bilmez.");
    return;
  }
  send({ type: "updateProfile", profile });
}

function renderProfileStats() {
  const stats = state.myHistory?.stats || state.profile?.stats || {};
  els.profileStats.textContent = `${stats.games || 0} oyun · ${stats.wins || 0} qalibiyyet · ${stats.winRate || 0}%`;
}

function requireProfile() {
  if (state.profile?.id) return true;
  flash("Evvelce qeydiyyatdan kec.");
  renderAuth();
  return false;
}

function renderRoomList() {
  const rooms = state.rooms.filter((room) => room.gameType === state.gameType);
  if (!rooms.length) {
    els.roomList.innerHTML = '<div class="empty-room">Hazir otaq yoxdur</div>';
    return;
  }

  els.roomList.innerHTML = rooms.map((room) => `
    <button class="room-item" type="button" data-code="${room.code}">
      <span>
        <strong>${escapeHtml(room.hostName)}</strong>
        <small>${gameTitle(room.gameType)} · ${room.players}/${room.maxPlayers}</small>
      </span>
      <b>${room.code}</b>
    </button>
  `).join("");

  for (const button of els.roomList.querySelectorAll(".room-item")) {
    button.addEventListener("click", () => {
      send({ type: "joinRoom", name: playerName(), code: button.dataset.code });
    });
  }
}

function renderProfileHistory() {
  if (!els.profileHistory) return;
  const rooms = state.myHistory?.rooms || [];
  const matches = state.myHistory?.matches || [];
  renderProfileStats();

  if (!rooms.length && !matches.length) {
    els.profileHistory.innerHTML = `${statsCards()}<div class="empty-room">Hele oyun tarixcesi yoxdur</div>`;
    return;
  }

  const roomItems = rooms.slice(0, 6).map((room) => `
    <article class="history-card">
      <strong>${gameTitle(room.gameType)} · ${room.code}</strong>
      <span>${room.players.map((player) => `${escapeHtml(player.name)} ${player.score ?? 0}`).join(" / ")}</span>
      <small>${(room.events || []).slice(0, 3).map((event) => escapeHtml(event.message)).join(" · ")}</small>
    </article>
  `).join("");

  const matchItems = matches.slice(0, 4).map((match) => `
    <article class="history-card winner">
      <strong>${gameTitle(match.gameType)} bitdi · ${escapeHtml(match.winner?.name || "Qalib")}</strong>
      <span>${(match.ranking || []).map((player) => `${player.place}. ${escapeHtml(player.name)} ${player.score}`).join(" / ")}</span>
    </article>
  `).join("");

  els.profileHistory.innerHTML = statsCards() + matchItems + roomItems;
}

function statsCards() {
  const stats = state.myHistory?.stats || state.profile?.stats || {};
  return `
    <div class="stats-grid">
      <div><strong>${stats.games || 0}</strong><span>Oyun</span></div>
      <div><strong>${stats.wins || 0}</strong><span>Qalibiyyet</span></div>
      <div><strong>${stats.winRate || 0}%</strong><span>Faiz</span></div>
      <div><strong>${stats.points || 0}</strong><span>Umumi xal</span></div>
    </div>
  `;
}

function savedServerAddress() {
  const saved = localStorage.getItem("domino101Server");
  const savedVersion = localStorage.getItem("domino101ServerVersion");
  const savedHost = displayServerHost(saved);
  if (savedHost && (savedVersion === SERVER_STORAGE_VERSION || !isLocalNetworkHost(savedHost))) return savedHost;
  localStorage.setItem("domino101Server", `wss://${DEFAULT_SERVER_HOST}`);
  localStorage.setItem("domino101ServerVersion", SERVER_STORAGE_VERSION);
  if (location.protocol.startsWith("http") && location.host && !isLocalAppHost(location.host)) return location.host;
  return DEFAULT_SERVER_HOST;
}

function normalizeServerAddress(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "") || DEFAULT_SERVER_HOST;
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  if (raw.startsWith("https://")) return `wss://${raw.replace(/^https?:\/\//, "")}`;
  if (raw.startsWith("http://")) return `ws://${raw.replace(/^https?:\/\//, "")}`;
  const protocol = raw.includes("onrender.com") || location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${raw.replace(/^https?:\/\//, "")}`;
}

function displayServerHost(value) {
  return String(value || "")
    .trim()
    .replace(/^wss?:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function isLocalAppHost(host) {
  return host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:");
}

function isLocalNetworkHost(host) {
  const cleanHost = displayServerHost(host).split(":")[0];
  return isLocalAppHost(cleanHost)
    || cleanHost.startsWith("192.168.")
    || cleanHost.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[01])\./.test(cleanHost);
}

function render() {
  const room = state.room;
  els.auth.classList.toggle("hidden", Boolean(state.profile));
  els.setup.classList.toggle("hidden", Boolean(room) || !state.profile);
  els.room.classList.toggle("hidden", !room);
  document.body.classList.toggle("in-room", Boolean(room));
  if (!room) return;

  const game = room.game;
  const isHost = room.hostId === state.clientId;
  const isMyTurn = game?.turnPlayerId === state.clientId && !game.roundOver;

  els.copyCodeButton.textContent = room.code;
  els.roomMeta.textContent = `${gameTitle(room.gameType)} · ${room.mode === "bot" ? "Bot" : "Online"}`;
  els.roundBadge.textContent = `El ${room.roundNumber || 0}`;
  els.startButton.hidden = !isHost;
  els.startButton.textContent = game?.matchOver ? "Yeni oyun" : game ? "Oyun gedir" : "Baslat";
  els.startButton.disabled = room.players.length < 2 || Boolean(game && !game.matchOver);
  els.message.textContent = game?.message || `Hedef: ${room.targetScore} xal`;

  renderSeats(room, game);
  renderScoreboard(room, game);
  renderChat(room);

  renderBoard(game);
  els.hand.innerHTML = game?.hand.map((tile) => {
    const required = game.requiredOpeningTileId === tile.id;
    return domino(tile.a, tile.b, true, tile.id, false, required);
  }).join("") || "";
  els.log.innerHTML = room.log.map((line) => `<div>${escapeHtml(line)}</div>`).join("");

  els.playLeftButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("left");
  els.playRightButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("right");
  els.passButton.disabled = !isMyTurn;

  for (const button of els.hand.querySelectorAll(".domino")) {
    button.addEventListener("click", () => {
      state.selectedTileId = button.dataset.id;
      renderSelection();
      updatePlayButtons();
    });
  }
}

async function inviteToRoom() {
  if (!state.room?.code) return;
  const url = "https://domino-101-online.onrender.com/";
  const text = `Domino otağına qoşul: ${state.room.code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Domino 101", text, url });
      return;
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`);
    flash("Devet metni kopyalandi.");
  } catch {
    flash("Devet etmek mumkun olmadi.");
  }
}

function renderChat(room) {
  const messages = room.chat || [];
  els.chatCount.textContent = String(messages.length);
  if (!messages.length) {
    els.chatList.innerHTML = '<div class="empty-room">Hele mesaj yoxdur</div>';
    return;
  }
  els.chatList.innerHTML = messages.map((message) => `
    <article class="chat-message ${message.clientId === state.clientId ? "me" : ""}">
      <strong>${escapeHtml(message.name || "Oyuncu")}</strong>
      <span>${escapeHtml(message.text)}</span>
    </article>
  `).join("");
  els.chatList.scrollTop = els.chatList.scrollHeight;
}

function renderScoreboard(room, game) {
  const ranking = room.ranking || [];
  els.scoreTarget.textContent = `Hedef ${room.targetScore}`;
  els.scoreboard.innerHTML = ranking.map((player) => {
    const isMe = player.id === state.clientId;
    const isWinner = game?.matchOver && player.place === 1;
    return `
      <article class="score-row ${isMe ? "me" : ""} ${isWinner ? "winner" : ""}">
        <b>${player.place}</b>
        <span>${escapeHtml(player.name)}${isMe ? " (sen)" : ""}</span>
        <strong>${player.score}</strong>
      </article>
    `;
  }).join("");
}

function renderBoard(game) {
  if (!game?.board?.length) {
    els.board.innerHTML = "";
    els.board.style.removeProperty("--board-cols");
    els.board.style.removeProperty("--board-rows");
    return;
  }

  const path = boardPath(game.board.length);
  const cols = Math.max(...path.map((point) => point.col)) + 1;
  const rows = Math.max(...path.map((point) => point.row)) + 1;
  els.board.style.setProperty("--board-cols", String(cols));
  els.board.style.setProperty("--board-rows", String(rows));
  els.board.innerHTML = game.board.map((tile, index) => {
    const point = path[index];
    const visualLeft = point.reverse && !point.vertical ? tile.right : tile.left;
    const visualRight = point.reverse && !point.vertical ? tile.left : tile.right;
    return `<div class="board-slot" style="grid-column:${point.col + 1};grid-row:${point.row + 1};">${domino(visualLeft, visualRight, false, "", tile.double || point.vertical, false, point.vertical)}</div>`;
  }).join("");
}

function boardPath(length) {
  const columnsPerRun = window.matchMedia("(max-width: 720px)").matches ? 7 : 9;
  const turnDepth = 2;
  const path = [];
  let col = 1;
  let row = 0;
  let direction = 1;
  let runCount = 0;
  let turnCount = 0;
  let turning = false;

  for (let i = 0; i < length; i += 1) {
    path.push({ col, row, vertical: turning, reverse: direction < 0 });

    if (turning) {
      row += 1;
      turnCount += 1;
      if (turnCount >= turnDepth) {
        turning = false;
        turnCount = 0;
        direction *= -1;
        col += direction;
      }
    } else {
      runCount += 1;
      if (runCount >= columnsPerRun) {
        turning = true;
        runCount = 0;
        row += 1;
      } else {
      col += direction;
      }
    }
  }

  return path;
}

function renderSeats(room, game) {
  const rankedIds = new Map((room.ranking || []).map((player) => [player.id, player.place]));
  const ordered = seatingOrder(room.players);
  const seats = [
    { el: els.seatBottom, player: ordered[0], className: "seat seat-bottom" },
    { el: els.seatLeft, player: ordered[1], className: "seat seat-left" },
    { el: els.seatTop, player: ordered[2], className: "seat seat-top" },
    { el: els.seatRight, player: ordered[3], className: "seat seat-right" }
  ];

  for (const seat of seats) {
    seat.el.className = seat.className;
    if (!seat.player) {
      seat.el.hidden = true;
      seat.el.innerHTML = "";
      continue;
    }
    seat.el.hidden = false;
    seat.el.innerHTML = playerCard(seat.player, room, game, rankedIds);
  }
}

function seatingOrder(players) {
  const meIndex = Math.max(0, players.findIndex((player) => player.id === state.clientId));
  const rotated = players.slice(meIndex).concat(players.slice(0, meIndex));
  if (rotated.length === 2) return [rotated[0], null, rotated[1], null];
  if (rotated.length === 3) return [rotated[0], rotated[1], rotated[2], null];
  return [rotated[0], rotated[1], rotated[2], rotated[3]];
}

function playerCard(player, room, game, rankedIds) {
  return `
    <article class="player ${game?.turnPlayerId === player.id ? "active" : ""}">
      <strong>${rankedIds.get(player.id) || "-"}. ${escapeHtml(player.name)}${player.id === state.clientId ? " (sen)" : ""}</strong>
      <span>${player.score}/${room.targetScore} xal · ${player.tileCount} das</span>
      <span>${player.bot ? "Bot" : player.connected ? "Online" : "Offline"}</span>
    </article>
  `;
}

function renderSelection() {
  for (const button of els.hand.querySelectorAll(".domino")) {
    button.classList.toggle("selected", button.dataset.id === state.selectedTileId);
  }
}

function updatePlayButtons() {
  const game = state.room?.game;
  const isMyTurn = game?.turnPlayerId === state.clientId && !game.roundOver;
  els.playLeftButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("left");
  els.playRightButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("right");
}

function playSelected(side) {
  if (!state.selectedTileId) return;
  playSound("click");
  send({ type: "playTile", tileId: state.selectedTileId, side });
}

function canPlaySelected(side) {
  const game = state.room?.game;
  const tile = game?.hand.find((item) => item.id === state.selectedTileId);
  if (!game || !tile) return false;
  if (game.requiredOpeningTileId && game.board.length === 0 && tile.id !== game.requiredOpeningTileId) return false;
  if (game.board.length === 0) return true;
  if (side === "left") return tile.a === game.left || tile.b === game.left;
  return tile.a === game.right || tile.b === game.right;
}

function domino(a, b, interactive, id = "", isDouble = false, required = false, forceVertical = false) {
  const tag = interactive ? "button" : "div";
  const attrs = interactive ? `type="button" data-id="${id}"` : "";
  const classes = ["domino", interactive || forceVertical ? "vertical" : "", isDouble ? "double" : "", required ? "required" : ""].filter(Boolean).join(" ");
  return `
    <${tag} class="${classes}" ${attrs} aria-label="${a}:${b}">
      ${pipBox(a)}
      ${pipBox(b)}
    </${tag}>
  `;
}

function pipBox(value) {
  const positions = {
    0: [],
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }[value];

  return `
    <span class="pipbox">
      ${Array.from({ length: 9 }, (_, index) => positions.includes(index + 1) ? '<i class="pip"></i>' : "<i></i>").join("")}
    </span>
  `;
}

function playerName() {
  return els.nameInput.value.trim() || state.profile?.name || "Oyuncu";
}

function loadSavedProfile() {
  if (!localStorage.getItem("domino101SessionToken")) return null;
  try {
    return JSON.parse(localStorage.getItem("domino101Profile") || "null");
  } catch {
    return null;
  }
}

function readAvatar(input, preview) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => resizeAvatar(String(reader.result || ""), preview));
  reader.readAsDataURL(file);
}

function resizeAvatar(dataUrl, preview) {
  const image = new Image();
  image.addEventListener("load", () => {
    const canvas = document.createElement("canvas");
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    const avatar = canvas.toDataURL("image/jpeg", 0.78);
    preview.dataset.avatar = avatar;
    renderAvatar(preview, { avatar, name: state.profile?.name || els.registerNameInput.value || "O" });
  });
  image.src = dataUrl;
}

function renderAvatar(element, profile = {}) {
  if (!element) return;
  const avatar = profile.avatar || element.dataset.avatar || "";
  element.dataset.avatar = avatar;
  if (avatar) {
    element.innerHTML = `<img src="${avatar}" alt="" />`;
    return;
  }
  element.textContent = initials(profile.name || profile.username || "O");
}

function initials(value) {
  return String(value || "O")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "O";
}

function playRoomSounds(room) {
  const game = room.game;
  const previous = state.lastSoundSnapshot;
  const current = {
    boardCount: game?.board?.length || 0,
    logHead: room.log?.[0] || "",
    roundNumber: room.roundNumber || 0,
    matchOver: Boolean(game?.matchOver)
  };

  state.lastSoundSnapshot = current;
  if (!previous) return;

  if (current.matchOver && !previous.matchOver) {
    playSound("win");
    return;
  }
  if (current.roundNumber > previous.roundNumber) {
    playSound("start");
    return;
  }
  if (current.boardCount > previous.boardCount) {
    playSound("tile");
    return;
  }
  if (current.logHead !== previous.logHead) {
    if (current.logHead.includes("xal")) playSound("score");
    else if (current.logHead.includes("kecdi") || current.logHead.includes("bazardan")) playSound("pass");
    else if (current.logHead.includes("qosuldu")) playSound("join");
  }
}

function playSound(kind) {
  if (!state.soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = playSound.context || new AudioContext();
  playSound.context = context;
  if (context.state === "suspended") context.resume();

  const patterns = {
    click: [[520, 0.035, "sine", 0.025]],
    tile: [[210, 0.045, "triangle", 0.05], [125, 0.04, "sine", 0.035, 0.035]],
    pass: [[160, 0.08, "sawtooth", 0.025]],
    score: [[540, 0.06, "sine", 0.04], [760, 0.08, "sine", 0.035, 0.06]],
    start: [[330, 0.08, "triangle", 0.035], [495, 0.08, "triangle", 0.035, 0.08]],
    win: [[430, 0.08, "sine", 0.04], [650, 0.1, "sine", 0.04, 0.08], [860, 0.14, "sine", 0.035, 0.18]],
    join: [[390, 0.05, "sine", 0.03]],
    leave: [[260, 0.08, "triangle", 0.03]]
  };

  for (const [frequency, duration, type, volume, delay = 0] of patterns[kind] || patterns.click) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}

function gameTitle(gameType) {
  return gameType === "phone" ? "Telefon" : "101";
}

function flash(message) {
  els.error.textContent = message;
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => {
    els.error.textContent = "";
  }, 3000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
