// ==UserScript==
// @name         Hidden Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  A potato gamemode for AMQ
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/hiddenPotato.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/hiddenPotato.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v0.0
 * - Initial version
 * Pastebin: https://pastebin.com/wrG5SaG8
 */

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

const setup = () => {
  /**
   * Enable/disable tracking
   */
  let potatoTracking = false;

  /**
   * Track scores (quizId -> {gamePlayerId -> score})
   * @type {Record<string, Record<number, number>>}
   */
  let quizPlayerScores = {};

  /**
   * Track potato passing (gamePlayerId -> gamePlayerId). If a player does not pass the potato, they will be considered as passing it to themselves.
   * @type {Record<number, number>}
   */
  let potatoPassing = {};

  new Listener("game chat update", (chat) => {
    chat.messages
      .filter((m) => m.sender === selfName && m.message.startsWith("/"))
      .forEach((m) => {
        if (/^\/hidden potato track/i.test(m.message)) {
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

  new Listener("player answers", (data) => {
    if (!potatoTracking) return;

    // Reset
    potatoPassing = {};

    data.answers.forEach((a) => {
      const potatoTarget = Object.values(quiz.players).find((p) =>
        a.answer.toLowerCase().includes(p.name.toLowerCase())
      );
      potatoPassing[a.gamePlayerId] =
        potatoTarget?.gamePlayerId ?? a.gamePlayerId;
    });

    console.debug("Potato passing", potatoPassing);
  }).bindListener();

  new Listener("answer results", (data) => {
    if (!potatoTracking) return;

    const quizId = quiz.quizDescription.quizId;

    if (!quizPlayerScores[quizId]) {
      quizPlayerScores[quizId] = {};
    }

    /** @type {Record<number, boolean>} gamePlayerId -> correct */
    const correctAnswers = Object.fromEntries(
      Object.values(data.players).map((p) => [p.gamePlayerId, p.correct])
    );

    /** Keep a reference to the initial scores to check for changes */
    const originalScores = JSON.stringify(quizPlayerScores[quizId]);

    Object.values(data.players).forEach((p) => {
      if (!quizPlayerScores[quizId][p.gamePlayerId])
        quizPlayerScores[quizId][p.gamePlayerId] = 0;

      // If A passes to A, apply normal scoring
      if (potatoPassing[p.gamePlayerId] === p.gamePlayerId) {
        quizPlayerScores[quizId][p.gamePlayerId] += p.correct ? 1 : 0;
      } else if (
        potatoPassing[potatoPassing[p.gamePlayerId]] === p.gamePlayerId
      ) {
        // If A passes to B and B passes back to A, remove one point from both (but not below 0)
        quizPlayerScores[quizId][p.gamePlayerId] = Math.max(
          0,
          quizPlayerScores[quizId][p.gamePlayerId] - 1
        );
      } else {
        // If A passes to B, and B submits the correct answer, A gets 1 point too
        quizPlayerScores[quizId][p.gamePlayerId] += correctAnswers[
          potatoPassing[p.gamePlayerId]
        ]
          ? 2
          : 0;
      }
    });

    // Write to chat the score for each player, sorted from highest to lowest
    const scores = Object.entries(quizPlayerScores[quizId])
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const player = Object.values(quiz.players).find(
          (p) => p.gamePlayerId == Number(id)
        );
        return `${player?.name}: ${score}`;
      })
      .join(", ");

    if (originalScores !== JSON.stringify(quizPlayerScores[quizId])) {
      sendChatMessage(scores);
    }
  }).bindListener();
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setup();
  }
}, 500);
