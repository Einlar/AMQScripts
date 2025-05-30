// ==UserScript==
// @name         Hot Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      1.32
// @description  Utilities for the hot potato gamemode. Alt+click on an avatar to pass the potato to them.
//               Commands:
//               - /potato help: Show the available commands
//               - /potato rules: Send a pastebin link with the rules
//               - /potato roll: Randomly assign a player of each team to have the potato before starting a game
//               - /potato track: Enable auto-tracking of the potato. If enabled, at the start of each round, the script will autothrow a message showing who currently has the potato,
//                                and how many times the potato has been passed to each player. Something like: "🥔Player | 0 | 1 | 2".
//                                Note: You will need to manually tell the script who has the potato using ALT+click.
//                                If exactly one player gives a valid answer, and you have not manually passed the potato, the script will automatically do it for you.
//               - /potato untrack: Disable auto-tracking of the potato
//               - /potato script: Show a link to the script
//               - /potato track chat: additionally show the potato passes in chat for all to see
//               - /potato track limit <number>: limit the number of times the potato can be passed to the same player. Players who reach the limit will be marked with a ❌️.
//               - /potato track chat limit <number>: combine both the above options
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v1.32
 * - Added a "/potato script" command to show a link to download the script.
 * - If "/potato roll" is called when the quiz is started, it will update the potato haver immediately if none was set.
 * - Fixed "/potato roll" not being tracked by other players tracking the potato when used in lobby.
 *
 * v1.31
 * - Fixed a bug when passing from a player who isn't tracking the potato.
 *
 * v1.3
 * - The "/potato track" command will also track how many times the potato has been passed to each player.
 * - Added additional options to the "/potato track" command: "/potato track chat" to show the potato passes in chat for all to see, and "/potato track limit <number>" to limit the number of times the potato can be passed to the same player.
 * - Added a "/potato help" command to show the available commands and what they do.
 * - Fixed a bug that prevented /potato roll from working properly when used in lobby.
 * - Fixed an interaction with the auto-key script that lead to the "auto-passing" message being spammed for the script host.
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
 * If true, potato passes will be sent to the chat for everyone to see.
 * Otherwise, only the player who used the "/potato track" command will see them.
 */
let chatTracking = false;

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
 * Maximum number of times during a game the potato can be passed to the same player.
 *
 * @type {number}
 */
let maxPotatoPasses = Infinity;

/**
 * Record how many times the potato has been passed to each player for the current game.
 * player name => number of passes
 *
 * @type {Record<string, number>}
 */
let potatoPassCount = {};

/**
 * Count a potato pass to a player.
 *
 * @param {string} playerName
 */
const countPotatoPass = (playerName) => {
  potatoPassCount[playerName] = (potatoPassCount[playerName] ?? 0) + 1;
};

/**
 * Check if the potato can be passed to a player given the current limit and counts.
 *
 * @param {string} playerName
 * @returns {boolean}
 */
const canGetPotato = (playerName) => {
  if (potatoPassCount[playerName] >= maxPotatoPasses) return false;
  return true;
};

/**
 * Click on an avatar to pass the potato to that player
 *
 * @param {string} playerName
 * @param {boolean} [replaceAnswer = true] If true, show the pass in the answer input
 * @returns {boolean} True if the potato was passed, false otherwise
 */
const passPotato = (playerName, replaceAnswer = true) => {
  if (!canGetPotato(playerName)) return false;

  // If nobody has the potato, set the current haver instead
  if (potatoTracking && !potatoHaver) {
    potatoHaver = playerName;
    countPotatoPass(potatoHaver);

    if (replaceAnswer) hasPotato(potatoHaver);
    if (chatTracking)
      sendChatMessage(
        `Team ${getMyTeam()}: ${formatPotatoStatus(potatoHaver)}`,
        false
      );

    return true;
  }

  // Otherwise, pass the potato normally
  nextPotatoHaver = playerName;
  if (replaceAnswer) sendAnswer(`🥔 to ${playerName}`, true);
  if (chatTracking)
    sendChatMessage(
      `Team ${getMyTeam()}: ${formatPotatoStatus(nextPotatoHaver)}`,
      false
    );
  return true;
};

/**
 * Get the list of player nmaes in the current team, sorted by their avatar position
 * @returns {string[]}
 */
const getCurrentTeamPlayers = () => {
  if (!quiz.inQuiz) return [];
  const myTeamPlayers = getMyTeamPlayers() ?? [];
  const players = Object.values(quiz.players)
    .filter((p) => myTeamPlayers.includes(p.name))
    .sort((a, b) => a.startPositionSlot - b.startPositionSlot);
  return players.map((p) => p.name);
};

/**
 * Format the count of potato passes for a player
 *
 * @param {string} playerName
 */
const formatPotatoPassCount = (playerName) => {
  let count = potatoPassCount[playerName] ?? 0;
  let msg = String(count);
  if (count >= maxPotatoPasses) msg += `❌️`;
  return msg;
};

/**
 * Format a message showing who has the potato and how many passes each player has.
 * Example: "🥔Player | 0 | 1 | 2"
 *
 * @param {string} [haver]
 */
const formatPotatoStatus = (haver) => {
  const players = getCurrentTeamPlayers();
  return players
    .map((p) => (haver === p ? `🥔${p}` : formatPotatoPassCount(p)))
    .join(" | ");
};

/**
 * Show who currently has the potato
 *
 * @param {string | null} haver
 */
const hasPotato = (haver) => {
  if (!haver) return sendAnswer("(🥔 has been lost)");
  sendAnswer(formatPotatoStatus(haver));
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
 * Returns a dictionary of team number => player names for the current quiz.
 *
 * @returns {Record<number, string[]> | undefined}
 */
const getTeamDictionary = () => {
  if (quiz.inQuiz) {
    if (!quiz.teamMode) return undefined;
    return Object.values(quiz.players).reduce((acc, player) => {
      // Coalesce missing team numbers to 0
      const teamNumber = player.teamNumber ?? 0;
      if (!acc[teamNumber]) acc[teamNumber] = [];
      acc[teamNumber].push(player.name);
      return acc;
    }, /** @type {Record<number, string[]>} */ ({}));
  }

  if (lobby.inLobby) {
    if (lobby.settings.teamSize === 1) return undefined;

    /** @type {Record<number, string[]>} */
    const teamDictionary = {};
    for (const player of Object.values(lobby.players)) {
      const teamNumber = Number(
        player.lobbySlot.$TEAM_DISPLAY_TEXT.text().trim()
      );

      if (isNaN(teamNumber)) return undefined; // Some player has not selected a team yet

      if (!teamDictionary[teamNumber]) teamDictionary[teamNumber] = [];
      teamDictionary[teamNumber].push(player.name);
    }

    return teamDictionary;
  }

  return undefined;
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
  const teams = getTeamDictionary();
  if (!teams) return null;
  const myTeam = Object.entries(teams)
    .find(([_, players]) => players.includes(selfName))
    ?.shift();
  if (myTeam) return Number(myTeam);
  return null;
};

/**
 * Retrieve all the players in your current team
 *
 * @returns {string[] | null}
 */
const getMyTeamPlayers = () => {
  const teams = getTeamDictionary();
  if (!teams) return null;
  return (
    Object.values(teams).find((players) => players.includes(selfName)) ?? null
  );
};

/**
 * Display the script status as a system message
 */
const showStatus = () => {
  let msg = `Hot Potato tracking is ${potatoTracking ? "enabled" : "disabled"}`;
  if (potatoTracking) {
    msg += ` (chat: ${chatTracking ? "on" : "off"}, limit: ${
      maxPotatoPasses === Infinity ? "none" : maxPotatoPasses
    })`;
  }
  systemMessages([msg]);
};

/**
 * Print a sequence of system messages with a delay between each one
 *
 * @param {string[]} messages
 * @param {number} [delay = 200]
 * @returns {Promise<void>}
 */
const systemMessages = async (messages, delay = 200) => {
  for (const message of messages) {
    /** @type {Promise<void>} */
    const sendPromise = new Promise((resolve) => {
      setTimeout(() => {
        gameChat.systemMessage(message);
        resolve();
      }, delay);
    });
    await sendPromise;
  }
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

    const myTeamPlayers = getMyTeamPlayers() ?? [];

    // Alt+click to pass the potato
    Object.values(quiz.players)
      // Can only pass to teammates
      .filter((p) => myTeamPlayers.includes(p.name))
      .forEach((player) => {
        player.avatarSlot.$body.on("click", (event) => {
          if (event.altKey) {
            passPotato(player.name);
          }
        });
      });

    // Reset the potato pass count for the current game
    potatoPassCount = {};

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
          if (!teams) return sendChatMessage("Not all players are in a team");

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
              if (potatoTracking && players.includes(selfName)) {
                nextPotatoHaver = potatoPlayer;
                if (quiz.inQuiz && !potatoHaver) passPotato(potatoPlayer); // Immediately set the potato if it wasn't set
              }

              // When sending multiple messages, send them with a small delay between each other
              setTimeout(() => {
                sendChatMessage(
                  `Team ${team}: ${potatoPlayer} has the 🥔`,
                  m.teamMessage
                );
              }, (i + 1) * 200);
            });
        } else if (/^\/potato track/i.test(m.message)) {
          /** --- Potato tracking --- */
          potatoTracking = true;

          // Default values for the arguments
          chatTracking = false;
          maxPotatoPasses = Infinity;

          // Check if the user wants to track the potato in chat
          if (/chat/i.test(m.message)) {
            chatTracking = true;
          }

          const limitMatch = m.message.match(/limit (\d+)/i);
          if (limitMatch) {
            const limit = Number(limitMatch[1]);
            if (!isNaN(limit)) {
              maxPotatoPasses = limit;
            }
          }

          showStatus();
        } else if (/^\/potato untrack/i.test(m.message)) {
          /** --- Disable potato tracking --- */
          potatoTracking = false;
          showStatus();
        } else if (/^\/potato script$/i.test(m.message)) {
          /** --- Show a link to the script --- */
          sendChatMessage(
            "Hot Potato script: https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js"
          );
        } else if (/^\/potato help$/i.test(m.message)) {
          /** --- Help message --- */
          systemMessages([
            "Hot Potato commands: /potato rules, /potato roll, /potato track",
            "/potato rules: Show a link to the rules",
            "/potato roll: Roll for a random player in each team to have the potato",
            "/potato track: Enable auto-tracking of the potato",
            "/potato untrack: Disable auto-tracking of the potato",
            "/potato script: Show a link to download the script",
            "/potato track chat: additionally show the potato passes in chat for all to see",
            "/potato track limit <number>: limit the number of times the potato can be passed to the same player",
            "You can combine both options, e.g. /potato track chat limit 6",
          ]);
        }
      });

    const myTeamPlayers = getMyTeamPlayers() ?? [];

    // Parse potato rolls made by other players
    if (potatoTracking) {
      chat.messages
        .filter((m) => m.sender !== selfName)
        .forEach((m) => {
          const match = m.message.match(/Team \d+: (.+) has the 🥔/);
          if (match) {
            const player = match[1];
            if (myTeamPlayers.includes(player)) {
              gameChat.systemMessage(`Auto-passing 🥔 to ${player}`);
              nextPotatoHaver = player;
              if (quiz.inQuiz && !potatoHaver) passPotato(player);
            }
          }
        });
    }
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

          // Skip if passing to the current haver
          if (toPlayer === potatoHaver) return;

          // Pass just once
          if (toPlayer !== nextPotatoHaver) {
            passPotato(toPlayer, toPlayer !== selfName); // Avoid replacing own answer
          }
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
      const player = Object.values(quiz.players).find(
        (p) => p.name === toPlayer
      );

      const myTeamPlayers = getMyTeamPlayers();
      if (player && myTeamPlayers && myTeamPlayers.includes(toPlayer)) {
        if (toPlayer !== potatoHaver) {
          // Avoid spamming
          gameChat.systemMessage(`Auto-passing 🥔 to ${toPlayer}`);
        }

        const passed = passPotato(toPlayer, false);

        if (passed && getCurrentAnswer()?.includes("🥔")) {
          hasPotato(toPlayer);
        }
      }
    }
  }).bindListener();

  // Show who has the potato when a new song is played
  new Listener("play next song", () => {
    if (!potatoTracking) return;

    // Count a pass if the potato has a new target
    // Otherwise, the potato will stay with the current player
    if (nextPotatoHaver) {
      potatoHaver = nextPotatoHaver;
      countPotatoPass(potatoHaver);
    }

    nextPotatoHaver = null;
    hasPotato(potatoHaver);
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
    setupMetadata();
    setupHotPotato();
  }
}, 500);

const setupMetadata = () => {
  AMQ_addScriptData({
    name: "Hot Potato Gamemode",
    author: "Einlar",
    version: "1.3",
    link: "https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js",
    description: `<p>Utilities for the <a href='https://pastebin.com/qdr4g6Jp'>hot potato gamemode</a></p>
      <p>Alt+click on an avatar to pass the potato to them.</p>
      <p>Commands:</p>
      <ul>
        <li>
          <p><code>/potato help</code>: Show the available commands</p>
        </li>
        <li>
          <p><code>/potato rules</code>: Send a pastebin link with the rules</p>
        </li>
        <li>
        <li>
          <p><code>/potato roll</code>: Randomly assign a player of each team to have the potato before starting a game</p>
        </li>
        <li>
          <p><code>/potato track</code>: Enable auto-tracking of the potato. If enabled, at the start of each round, the script will autothrow a message showing who currently has the potato,
                                and how many times the potato has been passed to each player. Something like: "🥔Player | 0 | 1 | 2".
                                Note: You will need to manually tell the script who has the potato using ALT+click.
                                If exactly one player gives a valid answer, and you have not manually passed the potato, the script will automatically do it for you.</p>
        </li>
        <li>
          <p><code>/potato untrack</code>: Disable auto-tracking of the potato</p>
        </li>
        <li>
          <p><code>/potato script</code>: Show a link to the script</p>
        </li>
        <li>
          <p><code>/potato track chat</code>: additionally show the potato passes in chat for all to see</p>
        </li>
        <li>
          <p><code>/potato track limit <number></code>: limit the number of times the potato can be passed to the same player. Players who reach the limit will be marked with a ❌️.</p>
        </li>
        <li>
          <p><code>/potato track chat limit <number></code>: combine both the above options</p>
        </li>
      </ul>`,
  });
};
