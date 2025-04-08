// ==UserScript==
// @name         {name}
// @namespace    http://tampermonkey.net/
// @version      0.0
// @description  {description}
// @author       {author}
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/{filename}.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/{filename}.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v0.0
 * - Initial version
 */

const setup = () => {
  // Script code here
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
