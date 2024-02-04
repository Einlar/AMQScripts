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
// @require      https://cdn.jsdelivr.net/npm/idb@8/build/umd.js
// ==/UserScript==

/**
 * Excalidraw:
 * - https://excalidraw.com/#room=e19d67e06915fd41b0c9,kiwAZmjoQy00hFqPfNhc3Q
 *
 * Sources
 * - AMQ Song History: https://github.com/Minigamer42/scripts/blob/master/src/amq%20song%20history%20(with%20localStorage).user.js
 * - IDB library: https://github.com/jakearchibald/idb/tree/main
 * - AMQ Even Better Song Artist: https://github.com/ToToTroll/AMQ-Scripts/blob/master/AMQ_Even_Better_Song_Artist/amqEvenBetterSongArtist.user.js
 * - Working with Indexed DB: https://web.dev/articles/indexeddb
 */

/**
 * Types
 *
 * @see https://github.com/Zolhungaj/AMQ-API/blob/main/src/main/java/tech/zolhungaj/amqapi/servercommands/gameroom/game/AnswerResults.kt
 * @typedef {Object} AnswerResults
 * @property {SongInfo} songInfo
 *
 * @typedef {Object} SongInfo
 * @property {AnimeNames} animeNames
 * @property {String} artist
 * @property {String} songName
 *
 * @typedef {Object} AnimeNames
 * @property {String} english
 * @property {String} romaji
 *
 * @typedef {Object} TeamMemberAnswer
 * @property {String} answer
 * @property {number} gamePlayerId
 */

/**
 * Constants
 */
const SONG_STORE = "songs";
const ARTIST_STORE = "artists";
const SA_FIELDS_ID = "songartist";
const MAX_DROPDOWN_ITEMS = 50;

/**
 * State
 */
const state = {
  /**
   * Whether the script is enabled or not
   * @type {Boolean}
   */
  active: false,
  /**
   * The array of song names loaded from the db
   * @type {String[]}
   */
  songNames: [],
  /**
   * Current anime guess
   */
  animeGuess: "",
  /**
   * Map between players and their avatar slots
   */
  players: new Map(),
};

/**
 * Check if the browser supports IndexedDB
 *
 * @returns {Boolean} True if the browser supports IndexedDB
 */
const checkCompatibility = () => {
  if (!("indexedDB" in window)) {
    console.error(
      "This browser doesn't support IndexedDB, so this script cannot work!"
    );
    return false;
  }
  console.log("IndexedDB is supported!");
  return true;
};

/**
 * Setup the IndexedDB database
 */
const setupIndexedDB = async () => {
  const db = await idb.openDB("AMQSongArtists", 1, {
    upgrade(db) {
      console.debug("Creating stores...");

      if (!db.objectStoreNames.contains(SONG_STORE)) {
        const store = db.createObjectStore(SONG_STORE, { keyPath: "name" });
        store.createIndex("name", "name", { unique: true });
      }

      if (!db.objectStoreNames.contains(ARTIST_STORE)) {
        const store = db.createObjectStore(ARTIST_STORE, { keyPath: "name" });
        store.createIndex("name", "name", { unique: true });
      }
    },
  });

  return db; //Test
};

/**
 * Append a new s/a to the database
 *
 * @param db The database
 * @param {Object} params
 * @param {String} params.songName
 * @param {String} params.artist
 */
const appendSong = async (db, { songName, artist }) => {
  try {
    const songTx = db.transaction(SONG_STORE, "readwrite");
    await Promise.all([songTx.store.add({ name: songName }), songTx.done]);

    // Keep state in sync
    state.songNames.push(songName);
  } catch (error) {
    console.debug("Song already exists, nothing to do");
  }

  try {
    const artistTx = db.transaction(ARTIST_STORE, "readwrite");
    await Promise.all([artistTx.store.add({ name: artist }), artistTx.done]);
  } catch (error) {
    console.debug("Artist already exists, nothing to do");
  }
};

/**
 * Clean a string by replacing all non-alphanumeric characters with spaces (so that length is not altered) and converting to lowercase.
 *
 * TODO: Should also replace special characters with their normal counterparts (e.g. é -> e)
 *
 * @param {String} str
 */
const cleanString = (str) => str.toLocaleLowerCase().replace(/[^a-z0-9]/g, " ");

/**
 * Search for a song name in the database
 *
 * @param db
 * @param {String} query
 * @returns {String[]}
 */
const searchSongs = (query) => {
  const cleanQuery = cleanString(query);
  return state.songNames.filter((song) =>
    cleanString(song).includes(cleanQuery)
  );
};

/**
 * Highlight a search term in an array of strings, ignoring special characters and case.
 *
 * @example
 * highlightSearch(["hello", "world"], "o") // ["hell<span class='saHighlight'>o</span>", "w<span class='saHighlight'>o</span>rld"]
 *
 * @param {String[]} songs
 * @param {String} highlight
 */
const highlightSearch = (songs, highlight) => {
  const cleanHighlight = cleanString(highlight);
  return songs.map((song) => {
    const cleanSong = cleanString(song);
    const index = cleanSong.indexOf(cleanHighlight);
    if (index === -1) return song;
    return `${song.slice(0, index)}<span class='saHighlight'>${song.slice(
      index,
      index + highlight.length
    )}</span>${song.slice(index + highlight.length)}`;
  });
};

class Dropdown {
  /**
   * Append a dropdown to the container.
   *
   * @param {JQuery} container JQuery object to append the dropdown to.
   * @param {Object} options
   * @param {(value: String) => void} options.onClick The function to call when a dropdown item is clicked (or when pressing Enter on it). The text of the item is passed as an argument.
   * @param {String} options.customClass The class to add to the dropdown.
   * @param {Number} options.maxItems The maximum number of items to show in the dropdown.
   */
  constructor(
    container,
    {
      onClickCallback,
      customClass = "saDropdown",
      maxItems = MAX_DROPDOWN_ITEMS,
    } = {}
  ) {
    this.container = container;
    this.dropdown = $(
      `<ul style="display: none;" class="${customClass}"></ul>`
    );
    this.container.append(this.dropdown);
    this.index = -1;
    this.onClickCallback = onClickCallback;
    this.maxItems = maxItems;

    // Allow to select the dropdown items with the arrow keys
    this.setupKeyboardNavigation();

    // Close the dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(`.${customClass}`)) {
        this.dropdown.hide();
      }
    });
  }

  /**
   * Load the dropdown with an array of values.
   * @param {String[] | null | undefined} values
   */
  load(values) {
    // Reset the state
    this.dropdown.empty();
    this.index = -1;

    // Avoid loading too many values
    values = values.slice(0, this.maxItems);

    // Load the values
    for (const value of values) {
      const li = $('<li class="saDropdownItem" tabindex="-1"></li>');
      li.html(value);
      li.on("click", (e) => {
        this.onClickCallback(e.target.innerText);
        this.dropdown.hide();
      });
      this.dropdown.append(li);
    }

    values.length > 0 ? this.dropdown.show() : this.dropdown.hide();
  }

  /**
   * Allow to select the dropdown items with the arrow keys
   * @private
   */
  setupKeyboardNavigation() {
    this.container.on("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.index = Math.min(
          this.index + 1,
          this.dropdown.children().length - 1
        );
        this.dropdown.children().eq(this.index).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.index = Math.max(this.index - 1, -1);
        this.dropdown.children().eq(this.index).focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.index !== -1) {
          this.onClickCallback(this.dropdown.children().eq(this.index).text());
          this.dropdown.hide();
        }
      }
    });
  }
}

// TODO: Script does not reload when rejoining a game!

/**
 * Send answer
 *
 * @param {String} answer
 */
const submitAnswer = (answer) => {
  $("#qpAnswerInput").val(answer);
  quiz.answerInput.submitAnswer(true);
};

/**
 * Build string with anime & s/a
 */
const buildSongArtistAnswer = (song) => `${state.animeGuess}<>${song}`;

/**
 * Setup s/a fields
 */
const setupSongArtistFields = () => {
  // Avoid adding the fields multiple times
  if (document.getElementById(SA_FIELDS_ID)) return;

  // Main container (starts hidden)
  const container = $(`<div style="display: none;"></div>`).attr(
    "id",
    SA_FIELDS_ID
  );
  $("#qpAnimeCenterContainer").append(container);

  const songInputContainer = $(
    `<div class="floatingContainer saAnswerField"></div>`
  );
  container.append(songInputContainer);

  // Input field
  const songInput = $(
    `<input type="text" class="flatTextInput" id="saSongInput" placeholder="Song Title" maxLength="150"/>`
  );
  songInputContainer.append(songInput);

  songInput.on("input", (e) => {
    //TODO This field should be disabled a few seconds before the guess ends
    // Or at least it should be debounced
    submitAnswer(buildSongArtistAnswer(e.target.value));
  });

  // Dropdown
  const dropdown = new Dropdown(songInputContainer, {
    onClickCallback: (value) => {
      songInput.val(value);
      songInput.focus();
      submitAnswer(buildSongArtistAnswer(value));
    },
  });

  songInput.on("input", (e) => {
    const value = e.target.value;
    const songs = searchSongs(value);
    dropdown.load(highlightSearch(songs, value));
  });

  const animeAnswerInput = $("#qpAnswerInput");

  animeAnswerInput.on("focus", function () {
    $(this).val(state.animeGuess);
  });

  animeAnswerInput.on("blur", function (e) {
    state.animeGuess = e.target.value;
    $(this).val(buildSongArtistAnswer(songInput.val()));
  });
};

/**
 * Toggle the script on/off
 */
const toggleScript = () => {
  state.active = !state.active;

  gameChat.systemMessage(
    `S/A Script is now ${state.active ? "enabled" : "disabled"}`
  );

  let songArtistFields = $(`#${SA_FIELDS_ID}`);
  if (songArtistFields) {
    state.active ? songArtistFields.show() : songArtistFields.hide();
  }
};

/**
 * Disable input to the s/a fields
 */
const lockSongArtistFields = () => {
  //TODO
};

/**
 * Reset the state
 */
const resetState = () => {
  state.animeGuess = "";

  // Reset the input fields
  $("#saSongInput").val("");
  $("#qpAnswerInput").val("");
};

/**
 * Wait a timeout
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Setup the players
 */
const setupPlayers = async (players) => {
  // Wait for quiz.players to finish setup
  while (window.quiz.players === undefined || window.quiz.players === null) {
    await sleep(250);
  }

  console.log({ players: window.quiz.players });

  // Reset
  state.players.clear();

  players.forEach(({ gamePlayerId }) => {
    const avatarSlot = window.quiz.players[gamePlayerId].avatarSlot;
    state.players.set(gamePlayerId, avatarSlot);

    const animeAnswerContainer = avatarSlot.$answerContainer;

    const songAnswerElement = animeAnswerContainer[0].cloneNode(true);
    songAnswerElement.style = "top:20px";
    avatarSlot.$innerContainer[0].appendChild(songAnswerElement);

    avatarSlot.$songAnswerContainer = $(songAnswerElement);
    avatarSlot.$songAnswerContainerText = avatarSlot.$songAnswerContainer.find(
      ".qpAvatarAnswerText"
    );

    const artistAnswerElement = animeAnswerContainer[0].cloneNode(true);
    artistAnswerElement.style = "top:60px";
    avatarSlot.$innerContainer[0].appendChild(artistAnswerElement);
    avatarSlot.$artistAnswerContainer = $(artistAnswerElement);
    avatarSlot.$artistAnswerContainerText =
      avatarSlot.$artistAnswerContainer.find(".qpAvatarAnswerText");
  });
};

/**
 * Show a song guess
 */
const showAnswer = ({ gamePlayerId, answer }) => {
  const answerContainer = state.players.get(gamePlayerId).$songAnswerContainer;
  const answerText = state.players.get(gamePlayerId).$songAnswerContainerText;

  // Remove a class from a JQuery element

  if (!answer) {
    answerContainer.addClass("hide");
  } else {
    answerContainer.removeClass("hide");
  }
  answerText.text(answer);
  window.fitTextToContainer(answerText, answerContainer, 23, 9); // The numbers, mason, what do they mean?
};

/**
 * Setup the script
 */
const setup = async () => {
  if (!checkCompatibility()) return;

  try {
    const db = await setupIndexedDB();

    // Load the song names from the database
    state.songNames = await db
      .getAll(SONG_STORE)
      .then((songs) => songs.map(({ name }) => name));

    /**
     * Expand local db by taking the data from the song info
     */
    const onAnswerResults = new Listener(
      "answer results",
      async (/** @type {AnswerResults}*/ result) => {
        await appendSong(db, {
          songName: result.songInfo.songName,
          artist: result.songInfo.artist,
        });
      }
    );
    onAnswerResults.bindListener();

    /**
     * Handle keyboard commands
     */
    const handleCommands = (e) => {
      if (e.altKey && e.key == "g") {
        toggleScript();
      }
    };

    /**
     * Setup when a quiz starts
     */
    const onQuizReady = new Listener("quiz ready", async () => {
      setupSongArtistFields();
      gameChat.systemMessage("S/A Script loaded!");
      gameChat.systemMessage("Press [Alt+G] to activate S/A mode");
      document.addEventListener("keydown", handleCommands);
      resetState();
    });
    onQuizReady.bindListener();

    /**
     * Teardown when a quiz ends
     */
    const onQuizEnd = new Listener("quiz end result", () => {
      document.removeEventListener("keydown", handleCommands);
    });
    onQuizEnd.bindListener();

    /**
     * Submit the anime guess at the end
     */
    const onGuessPhaseOver = new Listener("guess phase over", () => {
      // Reset answer to only the anime title
      submitAnswer(state.animeGuess);
    });
    onGuessPhaseOver.bindListener();

    /**
     * Lock the song/artist fields when showing the answers after the guess phase
     */
    const onPlayerAnswers = new Listener("player answers", () => {
      lockSongArtistFields();

      // For each key in state.players Map
      for (const [gamePlayerId, avatarSlot] of state.players.entries()) {
        // Hide the answer containers
        showAnswer({ gamePlayerId, answer: "Ciao" }); //TODO Insert the correct song name here (to be managed in the state), and do it only for the current player
      }

      console.log({ statePlayers: state.players });
    });
    onPlayerAnswers.bindListener();

    /**
     * Reset state when next song plays
     */
    const onPlayNextSong = new Listener("play next song", () => {
      resetState();
    });
    onPlayNextSong.bindListener();

    /**
     * Setup players when the game starts
     */
    const onGameStarting = new Listener("Game Starting", ({ players }) =>
      setupPlayers(players)
    );
    onGameStarting.bindListener();

    /**
     * Listen to team answers
     */
    const onTeamMemberAnswer = new Listener(
      "team member answer",
      (/** @type {TeamMemberAnswer} */ data) => {
        // Show the answer for that player
        const parts = data.answer.split("<>");
        const songName = parts[parts.length - 1];
        showAnswer({ gamePlayerId: data.gamePlayerId, answer: songName });
      }
    );
    onTeamMemberAnswer.bindListener();

    /**
     * Metadata
     */
    AMQ_addScriptData({
      name: "AMQ Song/Artist",
      author: "Einlar",
      version: "0.1",
      link: "https://github.com/Einlar/AMQScripts/blob/main/amqSongHistory.user.js",
      description: `
      <p>Once a game is started, press ALT+G to activate S/A mode and play with others who have the script</p>
      `,
    });

    AMQ_addStyle(`
      .saAnswerField {
        width: 80%;
        margin: 8px auto 5px;
        padding: 5px;
        position: relative;
      }

      .saDropdown {
        max-height: 190px;
        overflow: hidden;
        position: absolute;
        z-index: 9999 !important;
        width: 100%;
        background: #424242;
        border: none;
        box-shadow: 0 0 10px 2px rgb(0 0 0);
        border-radius: 0.3em;
        margin: 0.2em 0 0;
        text-shadow: none;
        box-sizing: border-box;
        list-style: none;
        padding: 0;
      }

      .saHighlight {
        color: #4497ea;
        font-weight: bold;
      }

      .saDropdownItem {
        background-color: #424242;
        position: relative;
        padding: 0.2em 0.5em;
        cursor: pointer;
      }

      .saDropdownItem:hover, .saDropdownItem:focus {
        background: #3d6d8f;
      }
    `);
  } catch (e) {
    console.error(e);
  }
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setup();
  }
}, 500);
