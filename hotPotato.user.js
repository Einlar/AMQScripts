// ==UserScript==
// @name         Hot Potato Gamemode
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Helpers for playing the Hot Potato gamemode in AMQ. Click on an avatar to pass the potato to that player.
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
 * Setup listeners
 */
const setupHotPotato = () => {
  new Listener("Game Starting", () => {
    console.log(quiz.players);
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
