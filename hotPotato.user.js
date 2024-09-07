// ==UserScript==
// @name         Hot Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Utilities for the hot potato gamemode. Alt+click on an avatar to pass the potato to them.
//               Commands:
//               - /potato rules: Send a pastebin link with the rules
//               - /potato roll: Randomly assign a player of each team to have the potato before starting a game
//               - /potato track: Enable/disable auto-tracking of the potato (experimental). If enabled, at the start of each round, the script will autothrow a message showing who currently has the potato.
//                                You will need to manually tell the script who has the potato using ALT+click. If exactly one player gives a valid answer, and you have not manually passed the potato,
//                                the script will automatically do it for you.
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @grant        none
// ==/UserScript==

/**
 * Enable/disable potato tracking
 */
let potatoTracking = false;

/**
 * Track the current potato haver (for the user's team)
 *
 * @type {string | null}
 */
let potatoHaver = null;

/**
 * Track who will have the potato during the next round
 *
 * @type {string | null}
 */
let nextPotatoHaver = null;

/**
 * Click on an avatar to pass the potato to that player
 *
 * @param {string} playerName
 */
const passPotato = (playerName) => {
  sendAnswer(`🥔 to ${playerName}`);
  nextPotatoHaver = playerName;
};

/**
 * Show who currently has the potato
 *
 */
const hasPotato = () => {
  if (potatoHaver) sendAnswer(`(${potatoHaver} has 🥔)`);
  else gameChat.systemMessage("No one has the 🥔");
};

/**
 * Send a message as answer
 *
 * @param {string} message
 */
const sendAnswer = (message) => {
  $("#qpAnswerInput").val(message);
  quiz.answerInput.submitAnswer(true);
};

/**
 * Check if the player is playing Ranked
 */
const isRanked = () =>
  (lobby.inLobby && lobby.settings.gamemode === "Ranked") ||
  (quiz.inQuiz && quiz.gameMode === "Ranked");

/**
 * Send a message in chat
 *
 * @param {string} msg
 * @param {boolean} teamMessage
 */
const sendChatMessage = (msg, teamMessage = false) => {
  socket.sendCommand({
    type: "lobby",
    command: "game chat message",
    data: {
      msg,
      teamMessage,
    },
  });
};

/**
 * Get a dictionary of team number => player names for the current quiz.
 * Adapted from https://github.com/kempanator/amq-scripts/blob/main/amqMegaCommands.user.js
 *
 * @returns {Record<number, string[]>}
 */
const getTeamDictionary = () => {
  if (!quiz.inQuiz && !lobby.inLobby) return {};
  const players = quiz.inQuiz ? quiz.players : lobby.players;

  return Object.values(players).reduce((acc, player) => {
    if (player.teamNumber == null) return acc;
    if (!acc[player.teamNumber]) acc[player.teamNumber] = [];
    acc[player.teamNumber].push(player.name);
    return acc;
  }, /** @type {Record<number, string[]>} */ ({}));
};

/**
 * Check if a string is a valid anime name (i.e. it appears in the dropdown list). Case insensitive.
 *
 * @param {string} animeName
 */
const isValidAnime = (animeName) => {
  return quiz.answerInput.typingInput.autoCompleteController.list.some(
    (anime) => anime.toLowerCase() === animeName.toLowerCase()
  );
};

/**
 * Get the team number of the current player
 *
 * @returns {number | null}
 */
const getMyTeam = () => {
  if (!quiz.inQuiz && !lobby.inLobby) return null;
  const players = quiz.inQuiz ? quiz.players : lobby.players;

  return Object.values(players).find((p) => p.isSelf)?.teamNumber ?? null;
};

/**
 * Feature list:
 * - [x] Alt+click to pass potato
 * - [x] Command to send pastebin with rules (https://pastebin.com/qdr4g6Jp)
 * - [x] Potato manual tracking
 * - [x] Command to roll teams (and set potato for script havers)
 * - [x] Potato auto-tracking (partial)
 */

/**
 * Display the script status as a system message
 */
const showStatus = () => {
  gameChat.systemMessage(
    `Hot Potato tracking is ${potatoTracking ? "enabled" : "disabled"}`
  );
};

/**
 * Setup listeners
 */
const setupHotPotato = () => {
  // Patch the quiz setup function to add a listener to the avatars
  const originalSetupQuiz = quiz.setupQuiz;
  quiz.setupQuiz = (...args) => {
    originalSetupQuiz.apply(quiz, args);

    // Skip setup if in ranked
    if (isRanked()) return;

    // BUGGED: Can only pass the potato in team games, and to teammates
    // const myTeam = getMyTeam();
    // console.log("My team is: ", myTeam);
    // if (myTeam == null) return;

    Object.values(quiz.players)
      //.filter((p) => p.teamNumber === myTeam)
      .forEach((player) => {
        player.avatarSlot.$body.on("click", (event) => {
          if (event.altKey) {
            passPotato(player.name);
          }
        });
      });

    showStatus();
  };

  // Handle chat commands
  new Listener("game chat update", (chat) => {
    // Disable everything during ranked
    if (isRanked()) return;

    chat.messages
      .filter((m) => m.sender === selfName && m.message.startsWith("/"))
      .forEach((m) => {
        if (/^\/potato rules$/i.test(m.message)) {
          /** --- Potato rules --- */
          sendChatMessage("Hot Potato rules: https://pastebin.com/qdr4g6Jp");
        } else if (/^\/potato roll$/i.test(m.message)) {
          /** --- Potato starting rolls --- */
          //TODO: Should parse the rolls made by other players too, so that the script can be used by multiple players in the same lobby
          const teams = getTeamDictionary();
          if (Object.keys(teams).length === 0)
            return sendChatMessage("No teams found");

          Object.entries(teams)
            // When in team chat, only roll for the current team
            .filter(([_, players]) =>
              m.teamMessage ? players.includes(selfName) : true
            )
            .forEach(([team, players], i) => {
              // Randomly choose a player to have the potato for each team
              const potatoPlayer =
                players[Math.floor(Math.random() * players.length)];

              // Set the next potato haver
              if (players.includes(selfName)) nextPotatoHaver = potatoPlayer;

              // When sending multiple messages, send them with a small delay between each other
              setTimeout(() => {
                sendChatMessage(
                  `Team ${team}: ${potatoPlayer} has the 🥔`,
                  m.teamMessage
                );
              }, (i + 1) * 200);
            });
        } else if (/^\/potato track$/i.test(m.message)) {
          /** --- Potato tracking --- */
          potatoTracking = !potatoTracking;
          setTimeout(
            () =>
              gameChat.systemMessage(
                `Potato tracking is now ${
                  potatoTracking ? "enabled" : "disabled"
                }`
              ),
            200
          );
        }
      });
  }).bindListener();

  // Could auto switch potato if exactly one player gives a valid answer
  new Listener("team member answer", (answer) => {
    if (!potatoTracking) return;

    if (nextPotatoHaver == null && isValidAnime(answer.answer)) {
      nextPotatoHaver = quiz.players[answer.gamePlayerId].name;
      gameChat.systemMessage(`Auto-passing 🥔 to ${nextPotatoHaver}`);
    }
  }).bindListener();

  // Show who has the potato when a new song is played
  new Listener("play next song", () => {
    if (!potatoTracking) return;

    potatoHaver = nextPotatoHaver;
    nextPotatoHaver = null;
    hasPotato();
  }).bindListener();

  // Reset potato rolls when the quiz ends
  new Listener("quiz over", () => {
    potatoHaver = null;
    nextPotatoHaver = null;
  }).bindListener();
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setupHotPotato();
  }
}, 500);
