const DEFAULT_SERVER_HOST = !isNativeShell() && ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? window.location.host
  : "domino-101-online.onrender.com";
const SERVER_STORAGE_VERSION = "render-v1";
const FIREBASE_WEB_FALLBACK_CONFIG = {
  apiKey: "AIzaSyC8Z024Vsi2VDOcKXLIXizy8sY7W0Ylo6E",
  authDomain: "domino-a6bfb.firebaseapp.com",
  projectId: "domino-a6bfb",
  storageBucket: "domino-a6bfb.firebasestorage.app",
  messagingSenderId: "763690904236",
  appId: "1:763690904236:web:65bfa84fea7aa1aeb6cd09",
  measurementId: "G-NG33ZL75ZG"
};

const state = {
  clientId: null,
  profile: loadSavedProfile(),
  myHistory: { matches: [], rooms: [] },
  leaderboard: { byWins: [], byPoints: [], byGames: [] },
  friendsState: { friends: [], incoming: [], outgoing: [] },
  friendSearchResults: [],
  activeFriendId: null,
  directMessages: {},
  leaderMode: "wins",
  room: null,
  rooms: [],
  selectedTileId: null,
  authMode: "login",
  mode: "online",
  gameType: "101",
  playerCount: 2,
  setupTab: "home",
  playConfiguratorOpen: true,
  gamePanel: null,
  soundEnabled: localStorage.getItem("domino101Sound") !== "off",
  lastSoundSnapshot: null,
  ws: null,
  googleAuth: null,
  googleProvider: null,
  googleAuthSdk: null,
  pendingGoogleUser: null,
  activeRoomCode: localStorage.getItem("domino101ActiveRoomCode") || "",
  lastRoomCode: localStorage.getItem("domino101LastRoomCode") || "",
  returningRoomCode: "",
  renderedHandTiles: new Set(),
  renderedBoardTiles: new Set(),
  seenScoreEventId: "",
  seenRoundSummaryId: ""
};

const els = {
  connection: document.querySelector("#connection"),
  auth: document.querySelector("#auth"),
  setup: document.querySelector("#setup"),
  room: document.querySelector("#room"),
  homeScreen: document.querySelector("#homeScreen"),
  friendsScreen: document.querySelector("#friendsScreen"),
  leaderboardScreen: document.querySelector("#leaderboardScreen"),
  profileScreen: document.querySelector("#profileScreen"),
  navHomeButton: document.querySelector("#navHomeButton"),
  navFriendsButton: document.querySelector("#navFriendsButton"),
  navLeaderboardButton: document.querySelector("#navLeaderboardButton"),
  navProfileButton: document.querySelector("#navProfileButton"),
  authLoginButton: document.querySelector("#authLoginButton"),
  authCreateButton: document.querySelector("#authCreateButton"),
  registerNameInput: document.querySelector("#registerNameInput"),
  registerUsernameInput: document.querySelector("#registerUsernameInput"),
  registerPasswordInput: document.querySelector("#registerPasswordInput"),
  avatarInput: document.querySelector("#avatarInput"),
  avatarPreview: document.querySelector("#avatarPreview"),
  registerButton: document.querySelector("#registerButton"),
  authDivider: document.querySelector(".auth-divider"),
  googleLoginButton: document.querySelector("#googleLoginButton"),
  googleAuthStatus: document.querySelector("#googleAuthStatus"),
  authError: document.querySelector("#authError"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileStats: document.querySelector("#profileStats"),
  profileNameInput: document.querySelector("#profileNameInput"),
  profileUsernameInput: document.querySelector("#profileUsernameInput"),
  profileAvatarInput: document.querySelector("#profileAvatarInput"),
  profileAvatarPreview: document.querySelector("#profileAvatarPreview"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  refreshLeaderboardButton: document.querySelector("#refreshLeaderboardButton"),
  leaderWinsButton: document.querySelector("#leaderWinsButton"),
  leaderPointsButton: document.querySelector("#leaderPointsButton"),
  leaderGamesButton: document.querySelector("#leaderGamesButton"),
  leaderboardList: document.querySelector("#leaderboardList"),
  refreshFriendsButton: document.querySelector("#refreshFriendsButton"),
  friendSearchForm: document.querySelector("#friendSearchForm"),
  friendSearchInput: document.querySelector("#friendSearchInput"),
  friendSearchResults: document.querySelector("#friendSearchResults"),
  friendRequests: document.querySelector("#friendRequests"),
  friendList: document.querySelector("#friendList"),
  directChatTitle: document.querySelector("#directChatTitle"),
  directChatList: document.querySelector("#directChatList"),
  directChatForm: document.querySelector("#directChatForm"),
  directChatInput: document.querySelector("#directChatInput"),
  soundToggleButton: document.querySelector("#soundToggleButton"),
  logoutButton: document.querySelector("#logoutButton"),
  nameInput: document.querySelector("#nameInput"),
  serverInput: document.querySelector("#serverInput"),
  roomInput: document.querySelector("#roomInput"),
  createRoomButton: document.querySelector("#createRoomButton"),
  friendsPlayButton: document.querySelector("#friendsPlayButton"),
  playConfigurator: document.querySelector("#playConfigurator"),
  lastGamePanel: document.querySelector("#lastGamePanel"),
  lastGameText: document.querySelector("#lastGameText"),
  returnRoomButton: document.querySelector("#returnRoomButton"),
  joinRoomButton: document.querySelector("#joinRoomButton"),
  refreshRoomsButton: document.querySelector("#refreshRoomsButton"),
  refreshHistoryButton: document.querySelector("#refreshHistoryButton"),
  profileHistory: document.querySelector("#profileHistory"),
  roomList: document.querySelector("#roomList"),
  lobby: document.querySelector("#lobby"),
  joinByCode: document.querySelector("#joinByCode"),
  game101Button: document.querySelector("#game101Button"),
  gamePhoneButton: document.querySelector("#gamePhoneButton"),
  playerCount2Button: document.querySelector("#playerCount2Button"),
  playerCount3Button: document.querySelector("#playerCount3Button"),
  playerCount4Button: document.querySelector("#playerCount4Button"),
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
  scoreToastLayer: document.querySelector("#scoreToastLayer"),
  roundSummaryModal: document.querySelector("#roundSummaryModal"),
  roundSummaryTitle: document.querySelector("#roundSummaryTitle"),
  roundSummaryBody: document.querySelector("#roundSummaryBody"),
  roundSummaryCloseButton: document.querySelector("#roundSummaryCloseButton"),
  board: document.querySelector("#board"),
  hand: document.querySelector("#hand"),
  scoreTarget: document.querySelector("#scoreTarget"),
  scoreboard: document.querySelector("#scoreboard"),
  chatCount: document.querySelector("#chatCount"),
  gameScoreButton: document.querySelector("#gameScoreButton"),
  gameChatButton: document.querySelector("#gameChatButton"),
  gameLogButton: document.querySelector("#gameLogButton"),
  scorePanel: document.querySelector("#scorePanel"),
  chatPanel: document.querySelector("#chatPanel"),
  historyPanel: document.querySelector("#historyPanel"),
  chatList: document.querySelector("#chatList"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatSendButton: document.querySelector("#chatSendButton"),
  log: document.querySelector("#log"),
  error: document.querySelector("#error"),
  playLeftButton: document.querySelector("#playLeftButton"),
  playRightButton: document.querySelector("#playRightButton"),
  playPhoneTopButton: document.querySelector("#playPhoneTopButton"),
  playPhoneBottomButton: document.querySelector("#playPhoneBottomButton"),
  passButton: document.querySelector("#passButton"),
  playAllDoublesButton: document.querySelector("#playAllDoublesButton")
};

els.serverInput.value = savedServerAddress();
bindControls();
connect();
renderSetup();
setupGoogleAuth();

let resizeTimer = null;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderBoard(state.room?.game), 120);
});

function bindControls() {
  els.authLoginButton.addEventListener("click", () => setAuthMode("login"));
  els.authCreateButton.addEventListener("click", () => setAuthMode("create"));
  els.registerButton.addEventListener("click", registerFromForm);
  els.googleLoginButton.addEventListener("click", signInWithGoogle);
  els.logoutButton.addEventListener("click", () => {
    state.googleAuthSdk?.signOut(state.googleAuth).catch(() => {});
    localStorage.removeItem("domino101Profile");
    localStorage.removeItem("domino101SessionToken");
    state.profile = null;
    state.myHistory = { matches: [], rooms: [], stats: null };
    state.friendsState = { friends: [], incoming: [], outgoing: [] };
    state.friendSearchResults = [];
    state.activeFriendId = null;
    state.directMessages = {};
    renderAuth();
  });
  els.avatarInput.addEventListener("change", () => readAvatar(els.avatarInput, els.avatarPreview));
  els.profileAvatarInput.addEventListener("change", () => readAvatar(els.profileAvatarInput, els.profileAvatarPreview));
  els.saveProfileButton.addEventListener("click", updateProfileFromForm);
  els.navHomeButton.addEventListener("click", () => setSetupTab("home"));
  els.navFriendsButton.addEventListener("click", () => setSetupTab("friends"));
  els.navLeaderboardButton.addEventListener("click", () => setSetupTab("leaderboard"));
  els.navProfileButton.addEventListener("click", () => setSetupTab("profile"));
  els.friendsPlayButton.addEventListener("click", () => setSetupTab("home"));

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
  els.playerCount2Button.addEventListener("click", () => setPlayerCount(2));
  els.playerCount3Button.addEventListener("click", () => setPlayerCount(3));
  els.playerCount4Button.addEventListener("click", () => setPlayerCount(4));

  els.createRoomButton.addEventListener("click", () => {
    if (!requireProfile()) return;
    send({ type: "createRoom", name: playerName(), gameType: state.gameType, players: state.playerCount });
  });

  els.joinRoomButton.addEventListener("click", () => {
    if (!requireProfile()) return;
    requestRoomReturn(els.roomInput.value);
  });
  els.returnRoomButton.addEventListener("click", () => requestRoomReturn(state.lastRoomCode));

  els.refreshRoomsButton.addEventListener("click", () => send({ type: "listRooms" }));
  els.refreshHistoryButton.addEventListener("click", () => send({ type: "getMyHistory" }));
  els.refreshLeaderboardButton.addEventListener("click", () => send({ type: "getLeaderboard" }));
  els.refreshFriendsButton.addEventListener("click", () => send({ type: "getFriends" }));
  els.friendSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    send({ type: "searchPlayers", query: els.friendSearchInput.value.trim() });
  });
  els.directChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.directChatInput.value.trim();
    if (!text || !state.activeFriendId) return;
    send({ type: "sendDirectMessage", friendId: state.activeFriendId, text });
    els.directChatInput.value = "";
  });
  els.leaderWinsButton.addEventListener("click", () => setLeaderMode("wins"));
  els.leaderPointsButton.addEventListener("click", () => setLeaderMode("points"));
  els.leaderGamesButton.addEventListener("click", () => setLeaderMode("games"));

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
  els.playPhoneTopButton.addEventListener("click", () => playSelected("phoneTop"));
  els.playPhoneBottomButton.addEventListener("click", () => playSelected("phoneBottom"));
  els.passButton.addEventListener("click", () => send({ type: "passTurn" }));
  els.playAllDoublesButton.addEventListener("click", () => playAllDoubles());
  els.gameScoreButton.addEventListener("click", () => toggleGamePanel("score"));
  els.gameChatButton.addEventListener("click", () => toggleGamePanel("chat"));
  els.gameLogButton.addEventListener("click", () => toggleGamePanel("log"));
  els.roundSummaryCloseButton?.addEventListener("click", closeRoundSummary);
  els.roundSummaryModal?.addEventListener("click", (event) => {
    if (event.target === els.roundSummaryModal) closeRoundSummary();
  });
}

function connect() {
  const address = normalizeServerAddress(els.serverInput.value);
  localStorage.setItem("domino101Server", address);
  localStorage.setItem("domino101ServerVersion", SERVER_STORAGE_VERSION);
  // Köhnə bağlantını bağla ki, dublikat soket qalmasın
  if (state.ws) { try { state.ws.close(); } catch (_) {} }
  const gen = (state.wsGen = (state.wsGen || 0) + 1);
  const ws = new WebSocket(address);
  state.ws = ws;

  ws.addEventListener("open", () => {
    if (gen !== state.wsGen) return;
    state.reconnectAttempts = 0;
    els.connection.textContent = "Online";
    const sessionToken = localStorage.getItem("domino101SessionToken");
    if (sessionToken) send({ type: "resumeSession", token: sessionToken });
    if (state.pendingGoogleUser) sendGoogleCredential(state.pendingGoogleUser);
    send({ type: "listRooms" });
    send({ type: "getLeaderboard" });
  });

  ws.addEventListener("close", () => {
    if (gen !== state.wsGen) return;
    els.connection.textContent = "Offline";
    // Eksponensial geri-çəkilmə (backoff) + jitter
    const attempt = (state.reconnectAttempts = (state.reconnectAttempts || 0) + 1);
    const delay = Math.min(15000, 800 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
    window.setTimeout(() => { if (gen === state.wsGen) connect(); }, delay);
  });

  ws.addEventListener("error", () => {
    els.connection.textContent = "Offline";
  });

  ws.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    try {
    if (message.type === "connected") {
      state.clientId = message.clientId;
    }
    if (message.type === "playerProfile") {
      state.profile = message.profile;
      try {
        if (message.sessionToken) localStorage.setItem("domino101SessionToken", message.sessionToken);
        localStorage.setItem("domino101Profile", JSON.stringify(message.profile));
      } catch (err) {
        console.warn("Profil yaddasa yazilmadi:", err);
      }
      els.nameInput.value = message.profile?.name || "";
      els.authError.textContent = "";
      renderAuth();
      send({ type: "getMyHistory" });
      send({ type: "getFriends" });
      // Reconnect-dən sonra da otağa qayıt (state.room hələ dolu ola bilər)
      if (state.activeRoomCode && !state.returningRoomCode) {
        requestRoomReturn(state.activeRoomCode);
      }
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
      state.room = null;
      state.activeRoomCode = "";
      state.selectedTileId = null;
      state.gamePanel = null;
      document.body.classList.remove("in-room");
      els.room.classList.add("hidden");
      localStorage.removeItem("domino101Profile");
      localStorage.removeItem("domino101SessionToken");
      localStorage.removeItem("domino101ActiveRoomCode");
      renderAuth();
    }
    if (message.type === "myHistory") {
      state.myHistory = message.history;
      renderProfileHistory();
    }
    if (message.type === "leaderboard") {
      state.leaderboard = message.leaderboard || { byWins: [], byPoints: [], byGames: [] };
      renderLeaderboard();
    }
    if (message.type === "friendsState") {
      state.friendsState = message.friendsState || { friends: [], incoming: [], outgoing: [] };
      if (state.activeFriendId && !state.friendsState.friends.some((friend) => friend.id === state.activeFriendId)) {
        state.activeFriendId = null;
      }
      renderFriends();
    }
    if (message.type === "friendSearchResults") {
      state.friendSearchResults = message.results || [];
      renderFriendSearchResults();
    }
    if (message.type === "directMessages") {
      const friendId = message.friendId || state.activeFriendId;
      if (friendId) state.directMessages[friendId] = message.messages || [];
      renderDirectChat();
    }
    if (message.type === "leftRoom") {
      playSound("leave");
      if (state.room?.code) saveLastRoomCode(state.room.code);
      state.activeRoomCode = "";
      localStorage.removeItem("domino101ActiveRoomCode");
      state.returningRoomCode = "";
      state.room = null;
      state.selectedTileId = null;
      state.gamePanel = null;
      state.setupTab = "home";
      state.playConfiguratorOpen = false;
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
      const enteringRoom = !state.room || state.room.code !== message.room.code;
      state.room = message.room;
      state.returningRoomCode = "";
      state.activeRoomCode = message.room.code;
      saveLastRoomCode(message.room.code);
      localStorage.setItem("domino101ActiveRoomCode", message.room.code);
      state.selectedTileId = null;
      if (enteringRoom) state.gamePanel = null;
      if (enteringRoom) {
        state.seenScoreEventId = message.room.game?.lastScoreEvent?.id || "";
        state.seenRoundSummaryId = message.room.game?.roundSummary?.id || "";
      } else {
        handleGameEvents(message.room);
      }
      render();
    }
    if (message.type === "error") {
      if (state.returningRoomCode && message.message?.includes("tapilmadi")) {
        state.returningRoomCode = "";
        state.activeRoomCode = "";
        state.lastRoomCode = "";
        localStorage.removeItem("domino101ActiveRoomCode");
        localStorage.removeItem("domino101LastRoomCode");
        renderSetup();
      }
      flash(message.message || "Xeta bas verdi.");
    }
    } catch (err) {
      console.error("Mesaj emali xetasi:", err);
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

function setGameType(gameType) {
  state.gameType = gameType;
  renderSetup();
}

function setPlayerCount(count) {
  state.playerCount = count;
  renderSetup();
}

function setSetupTab(tab) {
  state.setupTab = tab;
  renderSetup();
}

function toggleGamePanel(panel) {
  state.gamePanel = state.gamePanel === panel ? null : panel;
  renderGamePanels();
}

function requestRoomReturn(code) {
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode || !requireProfile()) return;
  state.returningRoomCode = cleanCode;
  els.roomInput.value = cleanCode;
  send({ type: "joinRoom", name: playerName(), code: cleanCode });
}

function saveLastRoomCode(code) {
  state.lastRoomCode = String(code || "").trim().toUpperCase();
  if (state.lastRoomCode) localStorage.setItem("domino101LastRoomCode", state.lastRoomCode);
}

function renderSetup() {
  renderAuth();
  updateSoundButton();
  els.game101Button.classList.toggle("active", state.gameType === "101");
  els.gamePhoneButton.classList.toggle("active", state.gameType === "phone");
  els.playerCount2Button.classList.toggle("active", state.playerCount === 2);
  els.playerCount3Button.classList.toggle("active", state.playerCount === 3);
  els.playerCount4Button.classList.toggle("active", state.playerCount === 4);
  els.createRoomButton.textContent = "Oyna";
  els.homeScreen.classList.toggle("hidden", state.setupTab !== "home");
  els.friendsScreen.classList.toggle("hidden", state.setupTab !== "friends");
  els.leaderboardScreen.classList.toggle("hidden", state.setupTab !== "leaderboard");
  els.profileScreen.classList.toggle("hidden", state.setupTab !== "profile");
  els.navHomeButton.classList.toggle("active", state.setupTab === "home");
  els.navFriendsButton.classList.toggle("active", state.setupTab === "friends");
  els.navLeaderboardButton.classList.toggle("active", state.setupTab === "leaderboard");
  els.navProfileButton.classList.toggle("active", state.setupTab === "profile");
  els.lastGamePanel.classList.toggle("hidden", !state.lastRoomCode);
  if (state.lastRoomCode) els.lastGameText.textContent = `Otaq ${state.lastRoomCode}`;
  if (state.lastRoomCode && !els.roomInput.value) els.roomInput.value = state.lastRoomCode;
  renderProfileHistory();
  renderLeaderboard();
  renderFriends();
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

async function setupGoogleAuth() {
  try {
    const authConfig = await loadGoogleAuthConfig();
    if (!authConfig.firebaseConfig) {
      els.googleAuthStatus.textContent = "Google girisi hele aktiv deyil.";
      return;
    }
    const [{ initializeApp }, authSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js")
    ]);
    const firebaseApp = initializeApp(authConfig.firebaseConfig);
    state.googleAuthSdk = authSdk;
    state.googleAuth = authSdk.getAuth(firebaseApp);
    state.googleProvider = new authSdk.GoogleAuthProvider();
    els.googleLoginButton.disabled = false;
    els.googleAuthStatus.textContent = "";

    const redirected = await authSdk.getRedirectResult(state.googleAuth);
    if (redirected?.user) {
      els.googleAuthStatus.textContent = "Google girisi tamamlanir...";
      await sendGoogleCredential(redirected.user);
    }
  } catch {
    els.googleAuthStatus.textContent = "Google girisi yuklenmedi.";
  }
}

async function loadGoogleAuthConfig() {
  if (isNativeShell()) {
    return { googleAuthEnabled: true, firebaseConfig: FIREBASE_WEB_FALLBACK_CONFIG };
  }

  const response = await fetch("/auth-config");
  const authConfig = await response.json();
  if (authConfig.googleAuthEnabled && authConfig.firebaseConfig) return authConfig;
  return { googleAuthEnabled: false, firebaseConfig: null };
}

async function signInWithGoogle() {
  if (!state.googleAuth || !state.googleProvider || !state.googleAuthSdk) return;
  els.googleLoginButton.disabled = true;
  els.authError.textContent = "";
  els.googleAuthStatus.textContent = "Google hesabina yonlendirilir...";
  try {
    await state.googleAuthSdk.signInWithRedirect(state.googleAuth, state.googleProvider);
  } catch {
    els.authError.textContent = "Google ile giris alinmadi.";
    els.googleLoginButton.disabled = false;
    els.googleAuthStatus.textContent = "";
  }
}

async function sendGoogleCredential(user) {
  if (state.ws?.readyState !== WebSocket.OPEN) {
    state.pendingGoogleUser = user;
    return;
  }
  state.pendingGoogleUser = null;
  const idToken = await user.getIdToken(true);
  send({ type: "googleLogin", idToken });
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

function setLeaderMode(mode) {
  state.leaderMode = mode;
  renderLeaderboard();
}

function renderLeaderboard() {
  if (!els.leaderboardList) return;
  els.leaderWinsButton.classList.toggle("active", state.leaderMode === "wins");
  els.leaderPointsButton.classList.toggle("active", state.leaderMode === "points");
  els.leaderGamesButton.classList.toggle("active", state.leaderMode === "games");
  const key = state.leaderMode === "points" ? "byPoints" : state.leaderMode === "games" ? "byGames" : "byWins";
  const players = state.leaderboard?.[key] || [];
  if (!players.length) {
    els.leaderboardList.innerHTML = '<div class="empty-room">Reytinq hele bosdur</div>';
    return;
  }

  els.leaderboardList.innerHTML = players.map((player, index) => {
    const stats = player.stats || {};
    const value = state.leaderMode === "points"
      ? `${stats.points || 0} xal`
      : state.leaderMode === "games"
        ? `${stats.games || 0} oyun`
        : `${stats.wins || 0} qalibiyyet`;
    return `
      <article class="leader-row ${player.id === state.profile?.id ? "me" : ""}">
        <b>${index + 1}</b>
        ${avatarMarkup(player, "tiny")}
        <span>
          <strong>${escapeHtml(player.name || "Oyuncu")}</strong>
          <small>@${escapeHtml(player.username || "player")} · ${stats.winRate || 0}%</small>
        </span>
        <em>${value}</em>
      </article>
    `;
  }).join("");
}

function renderFriends() {
  renderFriendSearchResults();
  renderFriendRequests();
  renderFriendList();
  renderDirectChat();
}

function renderFriendSearchResults() {
  if (!els.friendSearchResults) return;
  const results = state.friendSearchResults || [];
  if (!results.length) {
    els.friendSearchResults.innerHTML = "";
    return;
  }

  els.friendSearchResults.innerHTML = results.map((player) => `
    <article class="friend-row">
      ${avatarMarkup(player, "tiny")}
      <span>
        <strong>${escapeHtml(player.name || "Oyuncu")}</strong>
        <small>@${escapeHtml(player.username || "player")} · ${relationText(player.relation)}</small>
      </span>
      ${player.relation === "none"
        ? `<button type="button" data-friend-action="request" data-player-id="${escapeHtml(player.id)}">Dostluq</button>`
        : ""}
    </article>
  `).join("");

  for (const button of els.friendSearchResults.querySelectorAll("[data-friend-action='request']")) {
    button.addEventListener("click", () => {
      send({ type: "sendFriendRequest", targetPlayerId: button.dataset.playerId });
    });
  }
}

function renderFriendRequests() {
  if (!els.friendRequests) return;
  const incoming = state.friendsState?.incoming || [];
  const outgoing = state.friendsState?.outgoing || [];
  const incomingHtml = incoming.map((request) => `
    <article class="friend-row request">
      ${avatarMarkup(request.player, "tiny")}
      <span>
        <strong>${escapeHtml(request.player?.name || "Oyuncu")}</strong>
        <small>Dostluq teklifi gonderib</small>
      </span>
      <button type="button" data-request-id="${escapeHtml(request.id)}" data-accept="1">Qebul</button>
      <button type="button" data-request-id="${escapeHtml(request.id)}" data-accept="0">Imtina</button>
    </article>
  `).join("");
  const outgoingHtml = outgoing.map((request) => `
    <article class="friend-row muted">
      ${avatarMarkup(request.player, "tiny")}
      <span>
        <strong>${escapeHtml(request.player?.name || "Oyuncu")}</strong>
        <small>Teklif gozleyir</small>
      </span>
    </article>
  `).join("");

  els.friendRequests.innerHTML = incomingHtml + outgoingHtml;
  for (const button of els.friendRequests.querySelectorAll("[data-request-id]")) {
    button.addEventListener("click", () => {
      send({
        type: "respondFriendRequest",
        requestId: button.dataset.requestId,
        accept: button.dataset.accept === "1"
      });
    });
  }
}

function renderFriendList() {
  if (!els.friendList) return;
  const friends = state.friendsState?.friends || [];
  if (!friends.length) {
    els.friendList.innerHTML = '<div class="empty-room">Hele dost yoxdur</div>';
    return;
  }

  els.friendList.innerHTML = friends.map((friend) => `
    <button class="friend-tab ${friend.id === state.activeFriendId ? "active" : ""}" type="button" data-friend-id="${escapeHtml(friend.id)}">
      ${avatarMarkup(friend, "tiny")}
      <span>
        <strong>${escapeHtml(friend.name || "Oyuncu")}</strong>
        <small>@${escapeHtml(friend.username || "player")}</small>
      </span>
    </button>
  `).join("");

  for (const button of els.friendList.querySelectorAll("[data-friend-id]")) {
    button.addEventListener("click", () => {
      state.activeFriendId = button.dataset.friendId;
      send({ type: "getDirectMessages", friendId: state.activeFriendId });
      renderFriends();
    });
  }
}

function renderDirectChat() {
  if (!els.directChatList) return;
  const friend = (state.friendsState?.friends || []).find((item) => item.id === state.activeFriendId);
  els.directChatTitle.textContent = friend ? `${friend.name} ile yazisma` : "Dost sec";
  els.directChatInput.disabled = !friend;
  els.directChatForm.querySelector("button").disabled = !friend;
  if (!friend) {
    els.directChatList.innerHTML = '<div class="empty-room">Yazisma ucun dost sec</div>';
    return;
  }

  const messages = state.directMessages[state.activeFriendId] || [];
  if (!messages.length) {
    els.directChatList.innerHTML = '<div class="empty-room">Hele mesaj yoxdur</div>';
    return;
  }

  els.directChatList.innerHTML = messages.map((message) => `
    <article class="direct-message ${message.fromPlayerId === state.profile?.id ? "me" : ""}">
      <strong>${message.fromPlayerId === state.profile?.id ? "Sen" : escapeHtml(friend.name || "Dost")}</strong>
      <span>${escapeHtml(message.text)}</span>
    </article>
  `).join("");
  els.directChatList.scrollTop = els.directChatList.scrollHeight;
}

function relationText(relation) {
  if (relation === "friend") return "Dost";
  if (relation === "outgoing") return "Teklif gonderilib";
  if (relation === "incoming") return "Teklif var";
  return "Dost deyil";
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
      requestRoomReturn(button.dataset.code);
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
  if (isNativeShell()) {
    localStorage.setItem("domino101Server", `wss://${DEFAULT_SERVER_HOST}`);
    localStorage.setItem("domino101ServerVersion", SERVER_STORAGE_VERSION);
    return DEFAULT_SERVER_HOST;
  }
  if (location.protocol.startsWith("http") && location.host && isLocalNetworkHost(location.hostname)) {
    return location.host;
  }
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

function isNativeShell() {
  if (new URLSearchParams(window.location.search).has("apk")) return true;
  const capacitor = window.Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform() !== "web";
  return Boolean(capacitor.platform && capacitor.platform !== "web");
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
  els.startButton.disabled = Boolean(game && !game.matchOver);
  els.message.textContent = game?.message || `Hedef: ${room.targetScore} xal`;

  renderSeats(room, game);
  renderScoreboard(room, game);
  renderChat(room);
  renderGamePanels();

  renderBoard(game);
  els.hand.innerHTML = (game?.hand || []).map((tile) => {
    const required = game.requiredOpeningTileId === tile.id;
    const isNew = !state.renderedHandTiles.has(tile.id);
    if (isNew) state.renderedHandTiles.add(tile.id);
    const animateClass = isNew ? "animate-hand-drop" : "";
    return domino(tile.a, tile.b, true, tile.id, false, required, false, animateClass);
  }).join("") || "";
  els.log.innerHTML = room.log.map((line) => `<div>${escapeHtml(line)}</div>`).join("");

  els.playLeftButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("left");
  els.playRightButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("right");
  els.playPhoneTopButton.hidden = !game?.phone;
  els.playPhoneBottomButton.hidden = !game?.phone;
  els.playPhoneTopButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("phoneTop");
  els.playPhoneBottomButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("phoneBottom");
  els.passButton.disabled = !isMyTurn;

  // "Qoşaları oyna" düyməsi: Telefon oyununda, növbəm var, 2+ oynana bilən qoşa varsa göstər
  if (els.playAllDoublesButton) {
    const multiPlay = isMyTurn && game && room.gameType === "phone"
      ? findMultiDoublePlays(game, game.hand || [])
      : null;
    els.playAllDoublesButton.hidden = !multiPlay;
    els.playAllDoublesButton.dataset.plays = multiPlay ? JSON.stringify(multiPlay) : "";
  }

  for (const button of els.hand.querySelectorAll(".domino")) {
    button.addEventListener("click", () => {
      state.selectedTileId = button.dataset.id;
      renderSelection();
      updatePlayButtons();
    });
  }
}

function renderGamePanels() {
  if (!els.scorePanel) return;
  els.scorePanel.classList.toggle("hidden", state.gamePanel !== "score");
  els.chatPanel.classList.toggle("hidden", state.gamePanel !== "chat");
  els.historyPanel.classList.toggle("hidden", state.gamePanel !== "log");
  els.gameScoreButton.classList.toggle("active", state.gamePanel === "score");
  els.gameChatButton.classList.toggle("active", state.gamePanel === "chat");
  els.gameLogButton.classList.toggle("active", state.gamePanel === "log");
}

function handleGameEvents(room) {
  const scoreEvent = room?.game?.lastScoreEvent;
  if (scoreEvent?.id && scoreEvent.id !== state.seenScoreEventId) {
    state.seenScoreEventId = scoreEvent.id;
    playSound("score");
    showScoreToast(scoreEvent);
  }

  const summary = room?.game?.roundSummary;
  if (summary?.id && summary.id !== state.seenRoundSummaryId) {
    state.seenRoundSummaryId = summary.id;
    showRoundSummary(summary);
  }
}

function showScoreToast(scoreEvent) {
  if (!els.scoreToastLayer) return;
  const toast = document.createElement("div");
  toast.className = "score-toast";
  toast.textContent = `${scoreEvent.name || "Oyuncu"} +${scoreEvent.points} xal`;
  els.scoreToastLayer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function showRoundSummary(summary) {
  if (!els.roundSummaryModal || !els.roundSummaryBody) return;
  const winnerName = summary.winner?.name || "Oyuncu";
  const losers = (summary.hands || []).filter((player) => player.id !== summary.winner?.id);
  els.roundSummaryTitle.textContent = `${winnerName} eli qazandi`;
  els.roundSummaryBody.innerHTML = `
    <div class="round-summary-total">
      <strong>+${Number(summary.awardedPoints || 0)} xal</strong>
      <span>${escapeHtml(summary.reason || "El bitdi")} · xam cem ${Number(summary.rawPoints || 0)}</span>
    </div>
    <div class="round-summary-list">
      ${losers.map((player) => `
        <article class="round-summary-row">
          <div>
            <strong>${escapeHtml(player.name || "Oyuncu")}</strong>
            <span>${(player.tiles || []).map((tile) => `${tile.a}:${tile.b}`).join(" / ") || "das yoxdur"}</span>
          </div>
          <b>${Number(player.handValue || 0)}</b>
        </article>
      `).join("") || '<div class="empty-room">Hesablanacaq das yoxdur</div>'}
    </div>
  `;
  els.roundSummaryModal.classList.remove("hidden");
}

function closeRoundSummary() {
  els.roundSummaryModal?.classList.add("hidden");
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
    els.board.classList.remove("phone-board");
    return;
  }

  // Telefon oyununda düz xətt istifadə et — snake path branch ilə toqquşur
  const isPhoneGame = game.gameType === "phone";
  els.board.classList.toggle("phone-board", isPhoneGame);
  const path = isPhoneGame
    ? game.board.map((_, i) => ({ col: i, row: 0, vertical: false, reverse: false }))
    : boardPath(game.board.length);
  const phoneIndex = game.phone ? game.board.findIndex((tile) => tile.id === game.phone.tileId) : -1;
  const phonePoint = phoneIndex >= 0 ? path[phoneIndex] : null;
  const branchSlots = phonePoint ? phoneBranchSlots(game.phone, phonePoint) : [];
  const allPoints = path.concat(branchSlots);
  const minRow = Math.min(...allPoints.map((point) => point.row));
  const minCol = Math.min(...allPoints.map((point) => point.col));
  const normalized = allPoints.map((point) => ({ ...point, col: point.col - minCol, row: point.row - minRow }));
  const mainPath = normalized.slice(0, path.length);
  const branchPath = normalized.slice(path.length);
  const cols = Math.max(...normalized.map((point) => point.col)) + 1;
  const rows = Math.max(...normalized.map((point) => point.row)) + 1;
  els.board.style.setProperty("--board-cols", String(cols));
  els.board.style.setProperty("--board-rows", String(rows));
  const mainHtml = game.board.map((tile, index) => {
    const point = mainPath[index];
    const visualLeft = point.reverse && !point.vertical ? tile.right : tile.left;
    const visualRight = point.reverse && !point.vertical ? tile.left : tile.right;
    const isPhone = game.phone?.tileId === tile.id;
    const isNew = !state.renderedBoardTiles.has(tile.id);
    if (isNew) state.renderedBoardTiles.add(tile.id);
    const animateClass = isNew ? "animate-board-drop" : "";
    // Hub daşı (phone hub) həmişə perpendikulyar (şaquli) göstərilir
    const forceVert = point.vertical || isPhone;
    return `<div class="board-slot ${isPhone ? "phone-hub" : ""} ${animateClass}" style="grid-column:${point.col + 1};grid-row:${point.row + 1};">${domino(visualLeft, visualRight, false, "", tile.double || forceVert, false, forceVert)}</div>`;
  }).join("");
  const branchHtml = branchPath.map((point) => {
    const tile = point.tile;
    const visualTop = point.connectedEdge === "bottom" ? tile.right : tile.left;
    const visualBottom = point.connectedEdge === "bottom" ? tile.left : tile.right;
    const isNew = !state.renderedBoardTiles.has(tile.id);
    if (isNew) state.renderedBoardTiles.add(tile.id);
    const animateClass = isNew ? "animate-board-drop" : "";
    // Qoşa daşlar branch-da perpendikulyar (horizontal) olmalıdır; adi daşlar şaquli (vertical)
    const branchIsDouble = tile.double;
    return `<div class="board-slot phone-branch ${animateClass}" style="grid-column:${point.col + 1};grid-row:${point.row + 1};">${domino(visualTop, visualBottom, false, "", false, false, !branchIsDouble)}</div>`;
  }).join("");
  els.board.innerHTML = mainHtml + branchHtml;
}

function phoneBranchSlots(phone, phonePoint) {
  const slots = [];
  const topTiles = phone.top?.tiles || [];
  const bottomTiles = phone.bottom?.tiles || [];
  topTiles.forEach((tile, index) => {
    slots.push({ col: phonePoint.col, row: phonePoint.row - index - 1, vertical: true, branch: "top", connectedEdge: "bottom", tile });
  });
  bottomTiles.forEach((tile, index) => {
    slots.push({ col: phonePoint.col, row: phonePoint.row + index + 1, vertical: true, branch: "bottom", connectedEdge: "top", tile });
  });
  return slots;
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
      <span>${player.connected || player.bot ? "Online" : "Offline"}</span>
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
  const room = state.room;
  const isMyTurn = game?.turnPlayerId === state.clientId && !game.roundOver;
  els.playLeftButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("left");
  els.playRightButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("right");
  els.playPhoneTopButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("phoneTop");
  els.playPhoneBottomButton.disabled = !isMyTurn || !state.selectedTileId || !canPlaySelected("phoneBottom");

  if (els.playAllDoublesButton) {
    const multiPlay = isMyTurn && game && room?.gameType === "phone"
      ? findMultiDoublePlays(game, game.hand || [])
      : null;
    els.playAllDoublesButton.hidden = !multiPlay;
    els.playAllDoublesButton.dataset.plays = multiPlay ? JSON.stringify(multiPlay) : "";
  }
}

function playSelected(side) {
  if (!state.selectedTileId) return;
  playSound("click");
  send({ type: "playTile", tileId: state.selectedTileId, side });
}

function canPlaySelected(side) {
  const game = state.room?.game;
  const tile = game?.hand?.find((item) => item.id === state.selectedTileId);
  if (!game || !tile) return false;
  if (game.requiredOpeningTileId && game.board.length === 0 && tile.id !== game.requiredOpeningTileId) return false;
  if (game.board.length === 0) return true;
  if (side === "left") return tile.a === game.left || tile.b === game.left;
  if (side === "right") return tile.a === game.right || tile.b === game.right;
  if (side === "phoneTop" || side === "phoneBottom") {
    const branch = side === "phoneTop" ? game.phone?.top : game.phone?.bottom;
    return Boolean(branch && (tile.a === branch.end || tile.b === branch.end));
  }
  return false;
}

function domino(a, b, interactive, id = "", isDouble = false, required = false, forceVertical = false, extraClass = "") {
  const tag = interactive ? "button" : "div";
  const attrs = interactive ? `type="button" data-id="${id}"` : "";
  const classes = ["domino", interactive || forceVertical ? "vertical" : "", isDouble ? "double" : "", required ? "required" : "", extraClass].filter(Boolean).join(" ");
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
    <span class="pipbox pip-v${value}">
      ${Array.from({ length: 9 }, (_, index) => positions.includes(index + 1) ? '<i class="pip"></i>' : "<i></i>").join("")}
    </span>
  `;
}

// ─── ÇOX QOŞA OYNAMAQ (Multi-double play) ────────────────────────────
// Client tərəfdə board vəziyyətini simulyasiya edib bütün qoşaları eyni anda oynamaq
// mümkün olub-olmadığını yoxlayır

function clientNormalizeMove(game, tile, side) {
  if (game.board.length === 0) {
    const t = { ...tile, left: tile.a, right: tile.b, double: tile.a === tile.b };
    return { side: "right", tile: t, left: tile.a, right: tile.b };
  }
  if (side === "left") {
    if (tile.a === game.left) { const t = { ...tile, left: tile.b, right: tile.a, double: tile.a === tile.b }; return { side, tile: t, left: tile.b, right: game.right }; }
    if (tile.b === game.left) { const t = { ...tile, left: tile.a, right: tile.b, double: tile.a === tile.b }; return { side, tile: t, left: tile.a, right: game.right }; }
  }
  if (side === "right") {
    if (tile.a === game.right) { const t = { ...tile, left: tile.a, right: tile.b, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: tile.b }; }
    if (tile.b === game.right) { const t = { ...tile, left: tile.b, right: tile.a, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: tile.a }; }
  }
  if (game.phone) {
    if (side === "phoneTop") {
      const end = game.phone.top.end;
      if (tile.a === end) { const t = { ...tile, left: tile.a, right: tile.b, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: game.right, end: tile.b }; }
      if (tile.b === end) { const t = { ...tile, left: tile.b, right: tile.a, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: game.right, end: tile.a }; }
    }
    if (side === "phoneBottom") {
      const end = game.phone.bottom.end;
      if (tile.a === end) { const t = { ...tile, left: tile.a, right: tile.b, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: game.right, end: tile.b }; }
      if (tile.b === end) { const t = { ...tile, left: tile.b, right: tile.a, double: tile.a === tile.b }; return { side, tile: t, left: game.left, right: game.right, end: tile.a }; }
    }
  }
  return null;
}

function clientRefreshPhone(game) {
  if (game.phone || game.board.length < 3) return;
  const index = game.board.findIndex((t, i) => t.double && i > 0 && i < game.board.length - 1);
  if (index < 0) return;
  const tile = game.board[index];
  game.phone = {
    tileId: tile.id,
    value: tile.left,
    top: { end: tile.left, tiles: [] },
    bottom: { end: tile.left, tiles: [] }
  };
}

function clientPhoneScore(game) {
  clientRefreshPhone(game);
  if (!game.board.length) return 0;
  if (game.board.length === 1) {
    const t = game.board[0];
    if (t.double && t.left === 5) return 10;
    return 0;
  }
  const leftTile = game.board[0];
  const rightTile = game.board[game.board.length - 1];
  const leftVal = leftTile.double ? Number(game.left || 0) * 2 : Number(game.left || 0);
  const rightVal = rightTile.double ? Number(game.right || 0) * 2 : Number(game.right || 0);
  let total = leftVal + rightVal;
  if (game.phone) {
    const { top, bottom } = game.phone;
    if (top.tiles.length > 0) {
      const last = top.tiles[top.tiles.length - 1];
      total += last.double ? Number(top.end || 0) * 2 : Number(top.end || 0);
    }
    if (bottom.tiles.length > 0) {
      const last = bottom.tiles[bottom.tiles.length - 1];
      total += last.double ? Number(bottom.end || 0) * 2 : Number(bottom.end || 0);
    }
  }
  return total > 0 && total % 5 === 0 ? total : 0;
}

// Əldəki qoşaları simulyasiya edib oynana bilən kombinasiya qaytarır (xal yazırsa)
// Qaytarır: [{tileId, side}, ...] və ya null
function findMultiDoublePlays(game, hand) {
  if (!game || !hand) return null;
  const doubles = hand.filter((t) => t.a === t.b);
  if (doubles.length < 2) return null;

  const sim = JSON.parse(JSON.stringify(game));
  const simHand = hand.filter((t) => t.a === t.b).map((t) => ({ ...t }));
  const plays = [];
  const sides = ["left", "right", "phoneTop", "phoneBottom"];

  for (const tile of simHand) {
    let placed = false;
    for (const side of sides) {
      if ((side === "phoneTop" || side === "phoneBottom") && !sim.phone) continue;
      const move = clientNormalizeMove(sim, tile, side);
      if (!move) continue;

      // Simulyasiyaya tətbiq et
      sim.left = move.left;
      sim.right = move.right;
      if (side === "left") sim.board.unshift(move.tile);
      else if (side === "right") sim.board.push(move.tile);
      else if (side === "phoneTop") { sim.phone.top.tiles.push(move.tile); sim.phone.top.end = move.end; }
      else if (side === "phoneBottom") { sim.phone.bottom.tiles.push(move.tile); sim.phone.bottom.end = move.end; }
      clientRefreshPhone(sim);

      plays.push({ tileId: tile.id, side });
      placed = true;
      break;
    }
    if (!placed) return null; // Hər qoşa yerləşdirilə bilməlidir
  }

  if (plays.length < 2) return null;

  // Son mövqe xal yazırmı?
  const score = clientPhoneScore(sim);
  return score > 0 ? plays : null;
}

// Bütün oynana bilən qoşaları eyni anda servərə göndər
function playAllDoubles() {
  const playsRaw = els.playAllDoublesButton?.dataset?.plays;
  if (!playsRaw) return;
  let plays;
  try { plays = JSON.parse(playsRaw); } catch { return; }
  if (!plays || plays.length < 2) return;
  send({ type: "playDoubles", plays });
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
  if (!file.type.startsWith("image/")) {
    flash("Yalniz sekil faylini sec.");
    input.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    flash("Sekil cox boyukdur (maks 8MB).");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => resizeAvatar(String(reader.result || ""), preview));
  reader.addEventListener("error", () => flash("Sekil oxunmadi."));
  reader.readAsDataURL(file);
}

function resizeAvatar(dataUrl, preview) {
  const image = new Image();
  image.addEventListener("error", () => flash("Sekil yuklenmedi."));
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

// Yalnız etibarlı şəkil URL-lərinə icazə ver (XSS-in qarşısını al).
function safeAvatarUrl(value) {
  const url = String(value || "").trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(url)) return url;
  if (/^https:\/\/[^\s"'<>]+$/.test(url)) return url;
  return "";
}

function renderAvatar(element, profile = {}) {
  if (!element) return;
  const avatar = safeAvatarUrl(profile.avatar || element.dataset.avatar || "");
  element.dataset.avatar = avatar;
  if (avatar) {
    element.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
    return;
  }
  element.textContent = initials(profile.name || profile.username || "O");
}

function avatarMarkup(profile = {}, size = "") {
  const classes = ["avatar-preview", size].filter(Boolean).join(" ");
  const avatar = safeAvatarUrl(profile.avatar);
  if (avatar) return `<span class="${classes}"><img src="${escapeHtml(avatar)}" alt="" /></span>`;
  return `<span class="${classes}">${escapeHtml(initials(profile.name || profile.username || "O"))}</span>`;
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
    if (current.logHead.includes("kecdi") || current.logHead.includes("bazardan")) playSound("pass");
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

// home redesign: oyun növü + oyunçu sayı + tək "Oyna" düyməsi; seamless bot doldurma.
