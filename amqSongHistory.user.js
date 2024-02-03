// ==UserScript==
// @name         AMQ Song History (IndexedDB)
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Store all the songs you've played in an IndexedDB
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @downloadURL  
// @updateURL    
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// ==/UserScript==

// Run setup when in quiz
if (window.quiz) setup();

const setup = () => {
    // When answer results are shown, add the song to the history
    const onAnswerResults = new Listener("answer results", async (result) => {
        console.log("New result", result.songInfo.songName);
        console.log({result});
    })

    onAnswerResults.bindListener();
}