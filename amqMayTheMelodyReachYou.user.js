// ==UserScript==
// @name         AMQ May the Melody Reach You
// @namespace    http://tampermonkey.net/
// @version      0.81
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
const API_VERSION = "0.60";
const PREFIX = "[MayTheMelodyReachYou]";

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
    this.ws = new WebSocket(
      SOCKET_URL + "subscribe?quiz_id=" + quizId + `&player_name=${selfName}`
    );
    this.ws.onopen = () => {
      gameChat.systemMessage("Connected to S/A data 🎺");
    };
    this.ws.onclose = () => {
      gameChat.systemMessage("Disconnected from S/A data ❌");
      this.ws = null;
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
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * @param {string} id
   */
  pong(id) {
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: "pong", id }));
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
    player.answer = answers[player.gamePlayerId] || "";
  });
};

/**
 * Send a DM to a player
 *
 * @param {string} playerName
 * @param {string} message
 */
const sendDirectMessage = (playerName, message) => {
  socket.sendCommand({
    type: "social",
    command: "chat message",
    data: {
      target: playerName,
      message,
    },
  });
};

/**
 * Submit an answer to the quiz
 *
 * @param {string} answer
 */
const submitAnswer = (answer) => {
  if (quiz.inQuiz && !quiz.isSpectator) {
    $("#qpAnswerInput").val(answer);
    quiz.answerInput.submitAnswer(true);
  }
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
 * Retrieve the last submitted answer.
 *
 * @returns {string | null}
 */
const getLastSubmittedAnswer = () =>
  quiz.answerInput.typingInput.quizAnswerState.currentAnswer;

/**
 * @typedef {Object} StateMessage
 * @property {"state"} type
 * @property {string} quizId
 * @property {any} state
 *
 * @typedef {Object} BroadcastMessage
 * @property {"broadcast"} type
 * @property {string} quizId
 * @property {any} payload
 *
 * @typedef {Object} PingMessage
 * @property {"ping"} type
 * @property {string} id
 *
 * @typedef {Object} LatencyMessage
 * @property {"latency"} type
 * @property {number} latency
 *
 * @typedef {StateMessage | BroadcastMessage | PingMessage | LatencyMessage} Message
 */

const setup = () => {
  let active = false;

  /** @type {string | null} */
  let currentQuizId = null;

  /**
   * An hidden div that contains the S/A status (active or not). Create it with an id "esaIntegration" and append to body
   */
  $(document.body).append(
    $(/* html */ `
    <div id="esaIntegration" style="display: none;">off</div>
    `)
  );
  const $esaIntegration = $("#esaIntegration");

  const songInfo = new SongInfo();

  /**
   * The room id the script was activated in
   * @type {number | null}
   */
  let roomId = null;

  const ws = new WebSocketClient((msg) => {
    if (!quiz.inQuiz || quiz.quizDescription.quizId !== currentQuizId) {
      songInfo.reset();
      return ws.disconnect();
    }
    /** @type {Message} */
    const parsed = JSON.parse(msg);
    const type = parsed.type;

    switch (type) {
      case "state":
        if (parsed.state === null) {
          songInfo.setHostConnection(false);
          return;
        }

        songInfo.setHostConnection(true);

        if (parsed.state?.stats) {
          songInfo.setStats(parsed.state.stats);
        }

        if (parsed.state?.answers) {
          setAnswers(parsed.state.answers);
        }
        break;
      case "ping":
        const id = parsed.id;
        ws.pong(id);
        break;
      case "latency":
        songInfo.setLatency(parsed.latency);
        break;
      case "broadcast":
        if (parsed.payload.skip === true) {
          const songNumber = parsed.payload.songNumber;

          // Avoid skipping the wrong song
          if (
            songNumber !== undefined &&
            quiz.infoContainer.currentSongNumber !== songNumber
          )
            return;

          // Reset answer to avoid messing up the team guess (but only if necessary)
          const answer = getLastSubmittedAnswer();
          if (answer && isValidAnime(answer)) submitAnswer("/");
          quiz.skipController.voteSkip();
        }
        break;
    }
  });

  /**
   * Check if something else (e.g. the Ensemble S/A script) is already filling the SongInfo box.
   */
  const isSongInfoBoxFilled = () => {
    console.log($("#qpInfoHider").text().trim());
    return $("#qpInfoHider").text().trim() !== "?";
  };

  /**
   * @param {string} quizId
   */
  const start = (quizId) => {
    songInfo.setup();
    gameChat.systemMessage("S/A integration enabled (toggle with ALT+B)");
    currentQuizId = quizId;
    ws.connect(currentQuizId);
  };

  const stop = () => {
    gameChat.systemMessage("S/A integration disabled");
    songInfo.reset();
    ws.disconnect();
  };

  const toggle = () => {
    if (!lobby.inLobby && !quiz.inQuiz && !quiz.isSpectator) return;

    const newRoomId = hostModal.roomId;
    if (newRoomId !== "" && roomId !== newRoomId) {
      // Reset when room changes
      active = false;
      roomId = newRoomId;
    }

    active = ws === null ? true : !active;

    if (active) {
      if (isSongInfoBoxFilled()) {
        active = false;
        gameChat.systemMessage(
          "S/A integration cannot be enabled because the SongInfo box is already in use. Please disable the Ensemble S/A and try again."
        );
        return;
      }
      $esaIntegration.text("on");
    } else {
      stop();
      $esaIntegration.text("off");
    }

    if (active && quiz.inQuiz) {
      start(quiz.quizDescription.quizId);
    }

    if (active && !quiz.inQuiz) {
      gameChat.systemMessage(
        "S/A integration active, waiting for quiz to start..."
      );
    }
  };

  document.addEventListener("keydown", (e) => {
    if ((e.altKey || e.metaKey) && e.code === "KeyB") {
      toggle();
    }
  });

  new Listener("Game Starting", (payload) => {
    if (active && hostModal.roomId === roomId) {
      start(payload.quizDescription.quizId);
    }

    if (ws && hostModal.roomId !== roomId) {
      stop();
    }
  }).bindListener();

  new Listener("chat message", (payload) => {
    if (payload.message.startsWith(PREFIX)) {
      const command = payload.message.slice(PREFIX.length).trim();
      if (command === "version") {
        sendDirectMessage(payload.sender, `${PREFIX}V:${API_VERSION}`);
      }
      if (command === "activate") {
        if (!active) toggle();
      }
    }
  }).bindListener();

  // Hide script messages from DMs
  ChatBox.prototype.writeMessage = (function (originalWriteMessage) {
    return function () {
      if (arguments[1].startsWith(PREFIX)) return;
      return originalWriteMessage.apply(this, arguments);
    };
  })(ChatBox.prototype.writeMessage);
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

  constructor() {
    // Add a spacer to expand the SongInfo box up to the answer input dynamically
    $("#qpSongInfoLinkRow").before(
      $(/* html */ `
      <div id="esaSpacer"></div>
      `)
    );

    new Listener("answer results", () => {
      $("#esaSpacer").hide();
    }).bindListener();
  }

  /**
   * Setup the SongInfo box
   */
  setup() {
    $("#qpInfoHider").empty();
    $("#qpInfoHider").append(
      $(/* html */ `
        <div class="esaSongInfoList" id="esaSongInfo">
          <div class="esaSongInfoTitle">
            <h3>S/A Info&nbsp;<span id="esaHostConnection"></span></h3>
            <p style="text-align: center; font-size: 10px; margin: 0; margin-top: -10px;" id="esaLatency"></p>
          </div>
  
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
    // Hide the box until data is available
    this.hide();
  }

  /**
   * Set the latency shown in the SongInfo box
   * @param {number} latency
   */
  setLatency(latency) {
    $("#esaLatency").text(`(${latency}ms)`);
  }

  /**
   * Set whether the host connection is active or not
   *
   * @param {boolean} active
   */
  setHostConnection(active) {
    $("#esaHostConnection").text(active ? "🟢" : "🔴");
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

    const $match = $("<div>", { class: "esaSongInfoMatch" })
      .append(
        $("<div>", { class: "esaSongInfoItemName" }).text(
          bestGuess === "" ? "???" : bestGuess
        )
      )
      .append(
        $("<div>", { class: `esaSongInfoItemScore ${scoreClass}` }).text(
          `${Math.round(bestScore)}%`
        )
      );
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
    $("#esaSpacer").hide();
  }

  show() {
    // Expand the SongInfo box up to the answer input
    const songInfoContainer = $("#qpSongInfoContainer");
    const answerInputContainer = $("#qpAnswerInputContainer");

    const offset = Math.ceil(
      (answerInputContainer.offset()?.top ?? 0) +
        (answerInputContainer.height() ?? 0) -
        ((songInfoContainer.offset()?.top ?? 0) +
          (songInfoContainer.height() ?? 0))
    );
    if (offset > 0) {
      $("#esaSpacer").height(offset);
      $("#esaSpacer").show();
    }

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
        text-align: left;
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
