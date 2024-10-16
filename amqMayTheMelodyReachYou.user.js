// ==UserScript==
// @name         AMQ May the Melody Reach You
// @namespace    http://tampermonkey.net/
// @version      0.21
// @description  Show the Song/Artist matches for the current song when playing in a S/A room with the Ensemble Song Artist script enabled. Works even while spectating!
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/experimental/amqMayTheMelodyReachYou.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/experimental/amqMayTheMelodyReachYou.user.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @grant        none
// @icon         https://i.imgur.com/o8hOqsv.png
// ==/UserScript==

const SOCKET_URL = "wss://amq.amogus.it/";

class WebSocketClient {
  /**
   * The currently connected WebSocket (if any)
   * @type {WebSocket | null}
   */
  ws = null;

  /**
   * The callback that will be called when a message is received
   * @type {(message: string) => void}
   */
  callback;

  /**
   * @param {(message: string) => void} callback The callback that will be called when a message is received
   */
  constructor(callback) {
    this.callback = callback;
  }

  /**
   * Connect to the WebSocket server & subscribe to the specified quiz
   * @param {string} quizId The ID of the quiz to subscribe to
   */
  connect(quizId) {
    this.disconnect();
    this.ws = new WebSocket(SOCKET_URL + "subscribe?quiz_id=" + quizId);
    this.ws.onopen = () => {
      gameChat.systemMessage("Connected to S/A data 🎺");
    };
    this.ws.onmessage = (event) => {
      this.callback(event.data);
    };
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.ws) {
      gameChat.systemMessage("Disconnected from S/A data (retry with ALT+W)");
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Set the answers of team members in the quiz.
 * @param {Record<number, string>} answers Map of game player IDs to their answers
 */
const setAnswers = (answers) => {
  if (!quiz?.inQuiz) return;

  // Only update answers for spectators
  if (!quiz.isSpectator) return;

  Object.values(quiz.players).forEach((player) => {
    if (answers[player.gamePlayerId]) {
      player.answer = answers[player.gamePlayerId];
    }
  });
};

const setup = () => {
  let active = false;

  /** @type {string | null} */
  let currentQuizId = null;

  const songInfo = new SongInfo();

  const ws = new WebSocketClient((msg) => {
    if (!quiz.inQuiz || quiz.quizDescription.quizId !== currentQuizId) {
      return ws.disconnect();
    }
    const data = JSON.parse(msg)["data"];

    if (data?.stats) {
      songInfo.setStats(data.stats);
    }

    if (data?.answers) {
      setAnswers(data.answers);
    }
  });

  /**
   * @param {string} quizId
   */
  const start = (quizId) => {
    songInfo.setup();
    gameChat.systemMessage("Connecting to S/A data... (disable with ALT+W)");
    currentQuizId = quizId;
    ws.connect(currentQuizId);
  };

  const stop = () => {
    songInfo.reset();
    ws.disconnect();
  };

  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "w") {
      active = ws === null ? true : !active;

      if (!active) {
        stop();
      }

      if (active && quiz.inQuiz) {
        start(quiz.quizDescription.quizId);
      }
    }
  });

  new Listener("Game Starting", (payload) => {
    if (active) {
      start(payload.quizDescription.quizId);
    }
  }).bindListener();
};

/**
 * Display song/artist information in a box to the right of the video player, so that it is more readable than the answer input.
 */
class SongInfo {
  /**
   * Store the sequence of fully matched artists in order of matching.
   * @type {string[]}
   */
  matchedArtistsOrder = [];

  constructor() {}

  /**
   * Setup the SongInfo box
   */
  setup() {
    $("#qpInfoHider").empty();
    $("#qpInfoHider").append(
      $(/* html */ `
        <div class="esaSongInfoList" id="esaSongInfo">
          <div class="esaSongInfoTitle"><h3>S/A Info</h3></div>
  
          <div id="esaSongInfoSongName">
            <div class="esaSongInfoHeader">Song Name</div>
            <div id="esaSongInfoSongNameBox"></div>
          </div>
          
          <div id="esaSongInfoGroup">
            <div class="esaSongInfoHeader">Group</div>
            <div id="esaSongInfoGroupBox"></div>
          </div>
  
          <div id="esaSongInfoArtists">
            <div class="esaSongInfoHeader">Artists<span id="esaSongInfoArtistsNumber"></span></div>
            <div id="esaSongInfoArtistsBox"></div>
          </div>
        </div>
        `)
    );
  }

  /**
   * Style a match in the SongInfo box
   * @param {import('./types').Guess} guess
   * @returns {JQuery<HTMLElement>}
   */
  styleMatch({ bestGuess, bestScore }) {
    let scoreClass = "esaSongInfoItemScoreIncorrect";
    if (bestGuess !== "")
      scoreClass =
        bestScore > 99.9
          ? "esaSongInfoItemScoreCorrect"
          : "esaSongInfoItemScorePartial";

    const $match = $(/*html*/ `<div class="esaSongInfoMatch">
        <div class="esaSongInfoItemName">${
          bestGuess === "" ? "???" : bestGuess
        }</div>
        <div class="esaSongInfoItemScore ${scoreClass}">${Math.round(
      bestScore
    )}%</div>
      </div>`);
    return $match;
  }

  /**
   * Update the stats shown in the SongInfo box
   * @param {import('./types').Stats} stats
   */
  setStats(stats) {
    const $songName = this.styleMatch(stats.songName);
    $("#esaSongInfoSongNameBox").empty();
    $("#esaSongInfoSongNameBox").append($songName);

    if (stats.group) {
      $("#esaSongInfoGroup").show();
      const $group = this.styleMatch(stats.group);
      $("#esaSongInfoGroupBox").empty();
      $("#esaSongInfoGroupBox").append($group);
    } else {
      $("#esaSongInfoGroup").hide();
    }

    $("#esaSongInfoArtistsBox").empty();

    const partialMatches = stats.artists.filter((a) => a.bestScore <= 99.9);
    const fullMatches = stats.artists.filter((a) => a.bestScore > 99.9);

    // Reset ordering if needed
    if (fullMatches.length === 0) this.matchedArtistsOrder = [];

    const sortedPartialMatches = partialMatches.sort(
      (a, b) => b.bestScore - a.bestScore
    );

    // Sort the full matches by the order of matching. If the artist is not in the list, add it to the end.
    this.matchedArtistsOrder = [
      ...this.matchedArtistsOrder,
      ...fullMatches
        .filter((a) => !this.matchedArtistsOrder.includes(a.bestGuess))
        .map((a) => a.bestGuess),
    ];

    const sortedFullMatches = fullMatches.sort((a, b) =>
      this.matchedArtistsOrder.indexOf(a.bestGuess) >
      this.matchedArtistsOrder.indexOf(b.bestGuess)
        ? 1
        : -1
    );

    $("#esaSongInfoArtistsNumber").text(
      ` (${fullMatches.length}/${stats.artists.length})`
    );

    const $artists = [...sortedFullMatches, ...sortedPartialMatches].map(
      this.styleMatch
    );
    $("#esaSongInfoArtistsBox").append($artists);
    this.show();
  }

  hide() {
    $("#esaSongInfo").hide();
  }

  show() {
    $("#esaSongInfo").show();
  }

  reset() {
    $("#qpInfoHider").empty();
    $("#qpInfoHider").text("?");
  }
}

const setupMetadata = () => {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  AMQ_addStyle(/*css*/ `
    .esaSongInfoList {
        max-height: 100%;
        overflow-y: auto;
    }

    .esaSongInfoTitle {
        padding: 6px 12px;
        font-weight: bold;
        text-align: center;
    }

    .esaSongInfoHeader {
        padding: 6px 12px;
        font-size: 14px;
        font-weight: bold;
        top: 0;
    }

    .esaSongInfoMatch {
        padding: 4px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .esaSongInfoMatch:last-child {
        border-bottom: none;
    }

    .esaSongInfoItemName {
        font-size: 14px;
        overflow-wrap: break-word;
        word-wrap: break-word;
        height: auto;
        max-width: 70%;
        font-family: Menlo,Monaco,Consolas,"Courier New",monospace;
    }

    .esaSongInfoItemScore {
        font-size: 11px;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 12px;
        min-width: 36px;
        text-align: center;
    }

    .esaSongInfoItemScoreCorrect {
        color: #2e2c2c;
        background-color: #4CAF50;
    }

    .esaSongInfoItemScoreIncorrect {
        color: #fff;
        background-color: #F44336;
    }

    .esaSongInfoItemScorePartial {
        color: #2e2c2c;
        background-color: #FFC107;
    }
    `);
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setup();
    setupMetadata();
  }
}, 500);
