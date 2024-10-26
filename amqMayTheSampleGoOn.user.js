// ==UserScript==
// @name         MayTheSampleGoOn
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  When guessing phase end doesn't restart from the start sample but continue the music. Adapted from Mxyuki's script.
// @author       Mxyuki, Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/amqMayTheSampleGoOn.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/amqMayTheSampleGoOn.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * 1.1 - When looping, start from the very beginning and not just the sample start time.
 * 1.0 - Prevent the AMQ anti-cheat from breaking the sample looping.
 */

//@ts-ignore
if (document.getElementById("loginPage")) return;

let isLooperSetup = false;

new Listener("answer results", (payload) => {
  let endTime = parseFloat(
    quizVideoController.getCurrentPlayer().player.currentTime().toFixed(2)
  );
  setTimeout(function () {
    const currentPlayer = quizVideoController.getCurrentPlayer();
    currentPlayer.lastSeenTime = endTime; // Prevent the anti-cheat from detecting the skip
    currentPlayer.player.currentTime(endTime);

    // Handle loops manually instead of setting the "loop" attribute from videojs, to avoid the anti-cheat triggering and stopping the loop
    if (!isLooperSetup) {
      isLooperSetup = true;
      Object.values(quizVideoController.moePlayers).forEach((moePlayer) => {
        moePlayer.player.on("ended", () => {
          moePlayer.lastSeenTime = 0;
          moePlayer.player.currentTime(0);
        });
      });
    }
  }, 0.0001);
}).bindListener();
