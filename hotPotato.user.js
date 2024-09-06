// ==UserScript==
// @name         Hot Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Alt+click on an avatar to pass the potato to them.
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @downloadURL
// @updateURL
// @grant        none
// ==/UserScript==

/**
 * Click on an avatar to pass the potato to that player
 *
 * @param {import('./types').Player} player
 */
const passPotato = (player) => {
  sendAnswer(`🥔 > ${player.name}`);
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
 * Feature list:
 * - [x] Alt+click to pass potato
 * - [ ] Command to send pastebin with rules (https://pastebin.com/qdr4g6Jp)
 * - [ ] Potato manual tracking
 * - [ ] Command to roll teams (and set potato for script havers)
 */

/**
 * Setup listeners
 */
const setupHotPotato = () => {
  // Patch the quiz setup function to add a listener to the avatars
  const originalSetupQuiz = quiz.setupQuiz;
  quiz.setupQuiz = (...args) => {
    originalSetupQuiz.apply(quiz, args);
    Object.values(quiz.players).forEach((player) => {
      // TODO: check if the player is in the same team
      player.avatarSlot.$body.on("click", (event) => {
        if (event.altKey) {
          passPotato(player);
        }
      });
    });
  };
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
