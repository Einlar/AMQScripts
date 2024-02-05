// ==UserScript==
// @name         AMQ Team Song/Artist gamemode
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Play a song/artist game with one team.
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
 *
 * @typedef {Object} GameChat
 * @property {(message: String) => void} systemMessage
 */

/**
 * Globals
 */
const idb = /** @type {import('idb')} */ (window.idb);
const gameChat = /** @type {GameChat} */ (window.gameChat);
const Listener = window.Listener;

/** @type {String} Temporary variable for a test */ //TODO FIX
let myAnswer = "";

/**
 * Constants
 */
const SONG_STORE = "songs";
const ARTIST_STORE = "artists";
const SA_FIELDS_ID = "songartist";
const MAX_DROPDOWN_ITEMS = 50;

/**
 * Utilities
 */

/**
 * Clean a string by replacing all non-alphanumeric characters with spaces (so that length is not altered) and converting to lowercase.
 *
 * TODO: Should also replace special characters with their normal counterparts (e.g. é -> e)
 *
 * @param {String} str
 */
const cleanString = (str) => str.toLocaleLowerCase().replace(/[^a-z0-9]/g, " ");

/**
 * Highlight a query string in an array of strings, ignoring special characters and case.
 *
 * @example
 * highlightQuery(["hello", "world"], "o") // ["hell<span class='saHighlight'>o</span>", "w<span class='saHighlight'>o</span>rld"]
 *
 * @param {String[]} array
 * @param {String} highlight
 * @param {String} spanClass
 */
const highlightQuery = (array, highlight, spanClass = "saHighlight") => {
  const cleanHighlight = cleanString(highlight);
  return array.map((song) => {
    const cleanSong = cleanString(song);
    const index = cleanSong.indexOf(cleanHighlight);
    if (index === -1) return song;
    return `${song.slice(0, index)}<span class='${spanClass}'>${song.slice(
      index,
      index + highlight.length
    )}</span>${song.slice(index + highlight.length)}`;
  });
};

/**
 * Wait a timeout
 *
 * @param {Number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a variable to be defined up to a timeout (after which return null)
 *
 * @template T
 * @param {() => T} getter
 * @param {Number} timeout
 * @returns {Promise<T | null>}
 */
const waitForVariable = async (getter, timeout = 15000) => {
  const start = Date.now();
  let variable = getter();
  while (variable === undefined || variable === null) {
    if (Date.now() - start > timeout) return null;
    await sleep(250);
    variable = getter();
  }
  return variable;
};

class StoredArray {
  /**
   * An array stored both in memory and in the database, which can be queried.
   *
   * @param {SongArtistDB} songArtistDB
   * @param {String} store
   */
  constructor(songArtistDB, store) {
    this.songArtistDB = songArtistDB;
    this.store = store;

    /**
     * @type {String[]}
     */
    this.array = [];
  }

  /**
   * Return the array
   */
  get() {
    return this.array;
  }

  /**
   * Initialize the array from the db.
   */
  async load() {
    this.array = await this.songArtistDB.listFromStore(this.store);
  }

  /**
   * Append a value to the array (and sync with the db).
   *
   * @param {String} value
   */
  async append(value) {
    await this.songArtistDB.appendValueToStore(value, this.store);
    this.array.push(value);
  }

  /**
   * Return all the items matching a query string
   *
   * @param {String} query
   * @param {Boolean} highlight Whether to highlight the query in the results, by wrapping the matching part with a span
   */
  search(query) {
    const cleanQuery = cleanString(query);

    return this.array.filter((item) => cleanString(item).includes(cleanQuery));
  }
}

class SongArtistDB {
  /**
   * Interface to store arrays in the indexedDB.
   *
   * @param {String[]} storeNames
   */
  constructor(storeNames) {
    this.db = null;
    this.storeNames = storeNames;
  }

  /**
   * Create an array store (if not exists) containing all items with
   */
  createArrayStore(db, name) {
    if (!db.objectStoreNames.contains(name)) {
      const store = db.createObjectStore(name, { keyPath: "name" });
      store.createIndex("name", "name", { unique: true });
    }
  }

  /**
   * Check if the browser supports IndexedDB
   *
   * @returns {Boolean} True if the browser supports IndexedDB
   */
  checkCompatibility() {
    if (!("indexedDB" in window)) {
      console.error(
        "This browser doesn't support IndexedDB, so this script cannot work!"
      );
      return false;
    }
    console.log("IndexedDB is supported!");
    return true;
  }

  /**
   * Initialize the stores
   */
  async init() {
    if (!this.checkCompatibility()) return;
    if (this.db) return;

    this.db = await idb.openDB("AMQSongArtists", 1, {
      upgrade(db) {
        this.storeNames.forEach((name) => this.createArrayStore(db, name));
      },
    });
  }

  /**
   * Append an item to a store
   *
   * @param {String} value
   * @param {String} store The name of the store to append the value to
   */
  async appendValueToStore(value, store) {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(store, "readwrite");
      await Promise.all([tx.store.add({ name: value }), tx.done]);
    } catch (error) {
      console.debug(`${value} already exists in ${store}, nothing to do`);
    }
  }

  /**
   * Retrieve all the items from a store
   *
   * @param {String} store
   */
  async listFromStore(store) {
    return this.db.getAll(store).then((items) => items.map(({ name }) => name));
  }

  /**
   * Interface for a store
   */
  async getStore(store) {
    const array = new StoredArray(this, store); //Could be improved
    await array.load();

    return array;
  }
}

class Dropdown {
  /**
   * Append a dropdown to the container.
   *
   * @param {jQuery} container JQuery object to append the dropdown to.
   * @param {Object} options
   * @param {(value: String) => void} options.onSelectCallback The function to call when a dropdown item is clicked (or when pressing Enter on it). The text of the item is passed as an argument.
   * @param {String} options.customClass The class to add to the dropdown.
   * @param {Number} options.maxItems The maximum number of items to show in the dropdown.
   */
  constructor(
    container,
    {
      onSelectCallback,
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
    this.onSelectCallback = onSelectCallback;
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
        this.onSelectCallback(e.target.innerText);
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
          this.onSelectCallback(this.dropdown.children().eq(this.index).text());
          this.dropdown.hide();
        }
      }
    });
  }
}

class SongField {
  /**
   * Add the S/A fields to the page.
   *
   * @param {String} id
   * @param {StoredArray} songs Songs to be used for the song name dropdown
   */
  constructor(id, songs) {
    this.id = id;

    this.songs = songs;
    this.container = null;
    this.songInputContainer = null;

    /** @type {jQuery} */
    this.songInput = null;
  }

  init() {
    // Avoid creating the fields multiple times
    if (document.getElementById(this.id)) return;

    this.container = $(
      `<div id="${this.id}" style="display: none;"></div>`
    ).appendTo($("#qpAnimeCenterContainer"));

    this.songInputContainer = $(
      `<div class="floatingContainer saAnswerField"></div>`
    );
    this.container.append(this.songInputContainer);

    // Input field
    this.songInput = $(
      `<input type="text" class="flatTextInput" id="saSongInput" placeholder="Song Title" maxLength="150"/>`
    );
    this.songInputContainer.append(this.songInput);

    // Dropdown
    const dropdown = new Dropdown(this.songInputContainer, {
      onSelectCallback: (value) => {
        this.songInput.val(value);
        this.songInput.focus();
        myAnswer = value; //TODO Fix
        // submitAnswer(buildSongArtistAnswer(value));
      },
    });

    this.songInput.on("input", (e) => {
      const value = e.target.value;
      const results = this.songs.search(value);
      dropdown.load(highlightQuery(results, value));
    });

    // this.songInput.on("input", (e) => {
    //   submitAnswer(buildSongArtistAnswer(e.target.value));
    // });

    // const animeAnswerInput = $("#qpAnswerInput");

    // animeAnswerInput.on("focus", function () {
    //   if (state.active) $(this).val(state.animeGuess);
    // });

    // animeAnswerInput.on("blur", function (e) {
    //   if (state.active) {
    //     state.animeGuess = e.target.value;
    //     $(this).val(buildSongArtistAnswer(songInput.val()));
    //   }
    // });
  }

  /**
   * Hide/show the S/A fields
   */
  hide() {
    this.container.hide();
  }

  show() {
    this.container.show();
  }

  reset() {
    this.songInput.val("");
  }
}

class AnswerField {
  /**
   * A field on the avatar slot to display a player's answer.
   *
   * @param {Object} avatarSlot From quiz.players[gamePlayerId].avatarSlot
   * @param {number} index The index of the field (0 for song, 1 for artist)
   */
  constructor(avatarSlot, index) {
    this.element = avatarSlot.$answerContainer[0].cloneNode(true);
    this.element.style = `top:${20 + 40 * index}px`;
    avatarSlot.$innerContainer[0].appendChild(this.element);

    this.answerContainer = $(this.element);
    this.answerContainerText = this.answerContainer.find(".qpAvatarAnswerText");
  }

  /**
   * Display an answer in the field. If the answer is empty, hide the field.
   *
   * @param {string} answer
   */
  revealAnswer(answer) {
    !answer
      ? this.answerContainer.addClass("hide")
      : this.answerContainer.removeClass("hide");

    this.answerContainerText.text(answer);
    window.fitTextToContainer(
      this.answerContainerText,
      this.answerContainer,
      23,
      9
    );
  }

  /**
   * Highlight the field with green (correct) or red (wrong)
   *
   * @param {boolean} correct
   */
  highlight(correct) {
    this.answerContainerText.addClass(correct ? "rightAnswer" : "wrongAnswer");
  }

  /**
   * Reset the field
   */
  reset() {
    this.answerContainer.addClass("hide");
    this.answerContainerText.text("");
    this.answerContainerText.removeClass("wrongAnswer");
    this.answerContainerText.removeClass("rightAnswer");
  }
}

/**
 * @typedef {Object} PlayerFields
 * @property {AnswerField} song
 * @property {Boolean} isSelf
 *
 * @typedef {Object} QuizPlayerData
 * @property {Object} avatarSlot
 * @property {Boolean} isSelf
 * @property {String} _name
 * @property {Boolean} _host
 *
 * @typedef {Record<number, QuizPlayerData>} QuizPlayers
 */

class Players {
  /**
   * Manage the state of players and their fields.
   */
  constructor() {
    /**
     * Map of player IDs to their fields
     * @type {Map<number, PlayerFields>}
     */
    this.players = new Map();

    /**
     * Id of the current player
     *
     * @type {number}
     */
    this.currentPlayerId = -1;
  }

  /**
   * Initialize the players given their ids. Must be called after a game starts, when window.quiz.players is defined.
   *
   * @param {number[]} playerIds
   */
  async init(playerIds) {
    // Start from a clean state
    this.reset();

    const players = await waitForVariable(
      () => /** @type {QuizPlayers} */ (window.quiz.players)
    );

    if (!players) {
      gameChat.systemMessage(
        "Something went wrong while initializing the players, so S/A won't work! Sorry :("
      );
      return;
    }

    playerIds.forEach((id) => {
      const player = players[id];
      const { avatarSlot, isSelf } = player;

      if (isSelf) this.currentPlayerId = id;

      this.players.set(id, {
        song: new AnswerField(avatarSlot, 0),
        isSelf,
      });
    });

    console.log({ players: this.players });
  }

  /**
   * Reset answers
   */
  resetAllAnswers() {
    this.players.forEach((player) => {
      player.song.reset();
    });
  }

  /**
   * Reset the state
   */
  reset() {
    this.resetAllAnswers();
    this.players.clear();

    //TODO Should probably remove the fields from the DOM too...
  }

  /**
   * Get a player by id
   *
   * @type {number} id
   */
  getById(id) {
    return this.players.get(id);
  }

  /**
   * Get the current player
   */
  getSelf() {
    return this.players.get(this.currentPlayerId);
  }
}

class TeamSongArtist {
  constructor() {
    this.active = false;
    this.db = new SongArtistDB([SONG_STORE, ARTIST_STORE]);
    this.players = new Players();

    /**
     * @type {Record<String, Listener>}
     */
    this.listeners = {};

    // Fields
    this.songField = null;
  }

  /**
   * Initialize the script
   */
  async init() {
    try {
      this.setupMetadata();

      await this.db.init();

      const songs = await this.db.getStore(SONG_STORE);
      const artists = await this.db.getStore(ARTIST_STORE);

      this.songField = new SongField(SA_FIELDS_ID, songs);

      /**
       * Expand local db by taking the data from the song info
       * (This will work in the background even when the script is disabled, so the local db will continue to be expanded)
       */
      const onAnswerResults = new Listener(
        "answer results",
        async (/** @type {AnswerResults}*/ result) => {
          await songs.append(result.songInfo.songName);
          await artists.append(result.songInfo.artist);
        }
      );
      onAnswerResults.bindListener();

      this.setupListeners();
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Activate/deactivate the script
   */
  toggleScript() {
    this.active = !this.active;

    // Hide/show the s/a fields
    this.active ? this.songField.show() : this.songField.hide();

    // Reset when deactivating
    if (!this.active) this.players.resetAllAnswers();

    gameChat.systemMessage(
      `S/A Script is now ${this.active ? "enabled" : "disabled"}`
    );
  }

  /**
   * Handle keyboard commands
   */
  handleCommands(e) {
    // ALT+G to toggle the script
    if (e.altKey && e.key == "g") {
      this.toggleScript();
    }
  }

  /**
   * Reset the state
   */
  resetState() {
    this.songField.reset();
    this.players.resetAllAnswers();
    myAnswer = ""; //TODO FIX
  }

  /**
   * Instantiate all the listeners for the game's events
   */
  setupListeners() {
    const handleCommands = this.handleCommands.bind(this);

    this.listeners["onQuizReady"] = new Listener("quiz ready", async () => {
      console.debug("[TeamSongArtist] QuizReady");
      this.songField.init();
      this.resetState();
      gameChat.systemMessage("S/A Script loaded!");
      gameChat.systemMessage("Press [Alt+G] to activate S/A mode");
      document.addEventListener("keydown", handleCommands);
    });

    this.listeners["onQuizEnd"] = new Listener("quiz end result", () => {
      console.debug("[TeamSongArtist] QuizEnd");
      document.removeEventListener("keydown", handleCommands);
    });

    this.listeners["onPlayNextSong"] = new Listener("play next song", () => {
      console.debug("[TeamSongArtist] PlayNextSong");
      this.resetState();
    });

    this.listeners["onGameStarting"] = new Listener(
      "Game Starting",
      async ({ players }) => {
        const playerIds = players.map(({ gamePlayerId }) => gamePlayerId);

        await this.players.init(playerIds);
      }
    );

    this.listeners["onPlayerAnswers"] = new Listener("player answers", () => {
      if (this.active) {
        this.players.getSelf()?.song.revealAnswer(myAnswer);
      }
    });

    // Bind all the listeners
    Object.values(this.listeners).forEach((listener) =>
      listener.bindListener()
    );
  }

  /**
   * Add metadata to the "Installed Userscripts" list & populate CSS
   */
  setupMetadata() {
    // eslint-disable-next-line no-undef
    AMQ_addScriptData({
      name: "AMQ Song/Artist",
      author: "Einlar",
      version: "0.1",
      link: "https://github.com/Einlar/AMQScripts/blob/main/amqSongHistory.user.js",
      description: `
      <p>Once a game is started, press ALT+G to activate S/A mode and play with others who have the script</p>
      `,
    });

    // eslint-disable-next-line no-undef
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
  }
}

/**
 * Setup the script
 */
const setup = async () => {
  const teamSongArtist = new TeamSongArtist(); //TODO add to window?
  await teamSongArtist.init();
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
