// ==UserScript==
// @name         Hot Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Utilities for the hot potato gamemode. Alt+click on an avatar to pass the potato to them.
//               Commands:
//               - /potato rules: Send a pastebin link with the rules
//               - /potato roll: Randomly assign a player of each team to have the potato before starting a game
//               - /potato track: Enable/disable auto-tracking of the potato (experimental). If enabled, at the start of each round, the script will autothrow a message showing who currently has the potato.
//                                You will need to manually tell the script who has the potato using ALT+click. If exactly one player gives a valid answer, and you have not manually passed the potato,
//                                the script will automatically do it for you.
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v1.2
 * - Make the script work also on AMQ subdomains (since at the moment the main AMQ domain is not working).
 *
 * v1.1
 * - Fixed a bug in potato tracking, where if a player with auto-send enabled started writing something starting with "k" or "f" they would immediately receive the potato (because their answer for a brief moment was a valid anime name, and thus they were considered by the script the first to answer). Auto-passing now waits for a valid guess to persist for at least 0.5s before auto-passing.
 * - Potato tracking will now detect passes made by other players using the script
 */

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
 * Timeout for auto-passing the potato
 *
 * @type {number | null}
 */
let autoPassTimeout = null;

/**
 * Click on an avatar to pass the potato to that player
 *
 * @param {string} playerName
 */
const passPotato = (playerName) => {
  sendAnswer(`🥔 to ${playerName}`, true);
  nextPotatoHaver = playerName;
};

/**
 * Show who currently has the potato
 */
const hasPotato = () => {
  if (potatoHaver) sendAnswer(`(${potatoHaver} has 🥔)`);
  else gameChat.systemMessage("No one has the 🥔");
};

/**
 * Send a message as answer
 *
 * @param {string} message
 * @param {boolean} [fillInput = false] If true, fill the answer input with the message
 */
const sendAnswer = (message, fillInput = false) => {
  socket.sendCommand({
    type: "quiz",
    command: "quiz answer",
    data: { answer: message },
  });
  if (fillInput) {
    $("#qpAnswerInput").val(message);
    quiz.answerInput.submitAnswer(true);
  }
};

/**
 * Retrieve the current player's answer
 */
const getCurrentAnswer = () =>
  Object.values(quiz.players).find((p) => p.isSelf)?.answer;

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
    // Coalesce missing team numbers to 0
    const teamNumber = player.teamNumber ?? 0;
    if (!acc[teamNumber]) acc[teamNumber] = [];
    acc[teamNumber].push(player.name);
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
const getMyTeam = () =>
  Object.values(quiz.players).find((p) => p.isSelf)?.teamNumber ?? null;

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
  // Patch the quiz setup function to add a listener to the avatars. Works even after rejoining a quiz.
  const originalSetupQuiz = quiz.setupQuiz;
  quiz.setupQuiz = (...args) => {
    originalSetupQuiz.apply(quiz, args);

    // Skip setup if in ranked
    if (isRanked()) return;

    const myTeam = getMyTeam();

    // Alt+click to pass the potato
    Object.values(quiz.players)
      // Can only pass to teammates
      .filter((p) => p.teamNumber === myTeam)
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

    // Parse potato rolls made by other players
    chat.messages
      .filter((m) => m.sender !== selfName)
      .forEach((m) => {
        const match = m.message.match(/Team (\d+): (.+) has the 🥔/);
        if (match) {
          const team = parseInt(match[1]);
          const player = match[2];
          if (getMyTeam() === team) {
            gameChat.systemMessage(`Auto-passing 🥔 to ${player}`);
            nextPotatoHaver = player;
          }
        }
      });
  }).bindListener();

  // Auto-pass the potato to the first player who inputs a valid anime name (if the potato has not been passed yet)
  new Listener("team member answer", (answer) => {
    if (!potatoTracking) return;

    if (nextPotatoHaver == null) {
      if (isValidAnime(answer.answer)) {
        autoPassTimeout = setTimeout(() => {
          // Skip the auto-pass if the potato has been passed manually in the meantime
          if (nextPotatoHaver) return;

          const toPlayer = quiz.players[answer.gamePlayerId].name;
          gameChat.systemMessage(`Auto-passing 🥔 to ${toPlayer}`);
          nextPotatoHaver = toPlayer;
          // Avoid replacing your answer
          if (toPlayer !== selfName) passPotato(toPlayer);
        }, 500);
      } else if (autoPassTimeout) {
        // Skip auto-passing if the anime is changed to something else
        clearTimeout(autoPassTimeout);
      }
    }

    // Match the potato message in the answer "🥔 to ${playerName}", and in that case update the potato haver
    const selfId = Object.values(quiz.players).find(
      (p) => p.isSelf
    )?.gamePlayerId; // Is this even necessary?
    const match = answer.answer.match(/🥔 to (.+)$/);
    if (match && answer.gamePlayerId !== selfId) {
      const toPlayer = match[1];

      // Check if there is a team member with that name
      const myTeam = getMyTeam();
      const player = Object.values(quiz.players).find(
        (p) => p.name === toPlayer && p.teamNumber === myTeam
      );

      if (player) {
        gameChat.systemMessage(`Auto-passing 🥔 to ${toPlayer}`);
        potatoHaver = toPlayer;
        nextPotatoHaver = toPlayer;

        // Update the potato message (but only if you are not answering)
        if (getCurrentAnswer()?.includes("🥔")) {
          hasPotato();
        }
      }
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
