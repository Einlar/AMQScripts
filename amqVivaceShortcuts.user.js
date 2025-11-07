// ==UserScript==
// @name         AMQ Vivace! Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Displays at least 3 of the shortest shortcuts for an anime after guessing phase, defined as the shortest substrings of length 10 or less for which the target anime (or any of its alt names) is a suggestion in the dropdown list (a 1 character penalty represented by "↓" is applied for every position below the top that the name associated with the shortcut appears). Adapted from https://github.com/tutti-amq/amq-scripts/blob/main/animeShortcuts.user.js All shortcuts (that aren't longer version of shorter shortcuts) with the smallest length are displayed. Click on a shortcut to highlight it and move it to the front of the list.
// @author       Einlar, Tutti, kombofuud
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/amqVivaceShortcuts.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/amqVivaceShortcuts.user.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @grant        none
// @icon         https://i.imgur.com/o8hOqsv.png
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v1.8 (by kombofuud)
 * - Cap the maximum range of shortcuts length to 3, configurable via the MAX_LENGTH_DIFFERENTIAL variable. For instance, for a show where the shortest shortcut has length 5, only shortcuts up to length 8 will be shown. This avoids showing shortcuts that are too long (and thus not interesting).
 *
 * v1.7 (by kombofuud)
 * - Exclude shortcuts that contain a shorter shortcut as a subsequence (e.g. if "uron" is a shortcut, "uroun" wouldn't be added because it has the same letters in the same order + extra letters).
 * - Show shortcuts that are not the first suggestion in the dropdown list, but are still among the top ones. They include a "↓" character for each position below the top (counting as 1 character penalty).
 * - Exclude shortcuts containing "△"
 *
 * v1.6
 * - Remove shortcuts containing "∞" (e.g. for "Naki∞Neko")
 * - Fix a bug that prevented to highlight shortcuts containing a " (double quote).
 *
 * v1.5
 * - Make the script work also on AMQ subdomains (since at the moment the main AMQ domain is not working).
 *
 * v1.4
 * - Click on a shortcut to highlight it and move it to the front of the list. The highlighed shortcuts are stored in local storage.
 *
 * v1.3
 * - Shortcuts are now even more optimized! They will exploit the replacement rules used by AMQ.
 *   For instance, an optimal shortcut for "Kaguya-sama wa Kokurasetai?: Tensai-tachi no Renai Zunousen" is "? t", because a single space can be used to match any number of consecutive special characters.
 * - A few special characters are now allowed in the shortcuts (currently any of /*=+:;-?,.!@_#). Also all the characters that AMQ does not match with a space are allowed (e.g. "°", so you can use it as a shortcut for "Gintama°")
 */

/** @type {JQuery<HTMLElement>} */
var infoDiv;

/**
 * The maximum number of items in the dropdown list.
 */
const MAX_DROPDOWN_ITEMS = 25;

/**
 * The maximum length of shortcuts to consider. If a "perfect" shortcut is found (i.e. one that is the first suggestion in the dropdown list), the search will stop.
 */
const MAX_SUBSTRING_LENGTH = 10;

/**
 * Minimum number of shortcuts to display.
 */
const NUM_SHORTCUTS = 10;

/**
 * Whether or not to include shortcuts containing shorter shortcuts. (e.g. if "hi" is a shortcut, this will determine whether "his" is also a shortcut)
 */
const FULL_SHORTCUTS = false;

/**
 * Whether or not to include shortcuts that contain down arrows (shortcuts which bring a show on the menu, but not the top position)
 */
const TOP_SHORTCUTS_ONLY = false;

/**
 * how much longer a shortcut can be than the shortest one (e.g. if there's a 3 length shortcut and the variable is set to 3, nothing longer than 6 will be suggested)
 */
const MAX_LENGTH_DIFFERENTIAL = 10;

/**
* Prevents any nonstandard keyboard characters from appearing
*/

const WHITELIST_CHARACTERS_INSTEAD_OF_BLACKLIST = true;
const KEYBOARD_LAYOUT = "ANSI_104" // pick between "ANSI_104", "ISO", "JIS" or "CUSTOM"
const CUSTOM_LAYOUT = "";

/**
 * @see SEARCH_CHARACTER_REPLACEMENT_MAP from AMQ code
 */
const NORMALIZATION_MAP = {
  ō: "o",
  ó: "o",
  ò: "o",
  ö: "o",
  ô: "o",
  ø: "o",
  Φ: "o",
  ū: "u",
  û: "u",
  ú: "u",
  ù: "u",
  ü: "u",
  ǖ: "u",
  ä: "a",
  â: "a",
  à: "a",
  á: "a",
  ạ: "a",
  å: "a",
  æ: "a",
  ā: "a",
  č: "c",
  "★": " ",
  "☆": " ",
  "/": " ",
  "*": " ",
  "=": " ",
  "+": " ",
  "·": " ",
  "♥": " ",
  "∽": " ",
  "・": " ",
  "〜": " ",
  "†": " ",
  "×": "x", // I think we can safely replace this with "x"
  "♪": " ",
  "→": " ",
  "␣": " ",
  ":": " ",
  ";": " ",
  "~": " ",
  "-": " ",
  "?": " ",
  ",": " ",
  ".": " ",
  "!": " ",
  "@": " ",
  _: " ",
  "#": " ",
  "'": " ",
  é: "e",
  ê: "e",
  ë: "e",
  è: "e",
  ē: "e",
  ñ: "n",
  "²": "",
  í: "i",
  "³": "",
  ß: "b",
};

/**
 * These special characters can normally be collapsed into a space, but they are easy enough to type, so they will be allowed in the shortcuts.
 *
 * @type {(keyof typeof NORMALIZATION_MAP)[]}
 */
const ALLOWED_SPECIAL_CHARACTERS = [
  "/",
  "*",
  "=",
  "+",
  ":",
  ";",
  "-",
  "?",
  ",",
  ".",
  "!",
  "@",
  "_",
  "#",
  "'",
];

/**
 * These special characters are not matched by AMQ with a space, but they should still not be allowed in shortcuts.
 * (only applicable when WHITELIST_CHARACTERS_INSTEAD_OF_BLACKLIST is false)
 *
 * @type {string[]}
 */
const DISALLOWED_SPECIAL_CHARACTERS = ["∞", "△", "↓","°","♡","∬"];

/**
* Determines a list of allowed characters when HITELIST_CHARACTERS_INSTEAD_OF_BLACKLIST is true
* I hope I got the character sets right for JIS and ISO, if I got any of the characters wrong (or the wrong version of a character), please let @kombofuud know in the scripts-for-games channel.
*/
const ANSI_104 = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/? ";
const ISO = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890`¬!\"£$%^&*()-_=+[{]};:'@#~\\|',<.>/? ";
const JIS = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890`¥!\"#$%^&'()-_=+[{｢]}｣\\|;:『'…』,<.>/?・° ";
let FULL_CHARACTER_LIST;
switch (KEYBOARD_LAYOUT){
  case "ISO":
    FULL_CHARACTER_LIST = ISO;
    break;
  case "JIS":
    FULL_CHARACTER_LIST = ISO;
    break;
  case "CUSTOM":
    FULL_CHARACTER_LIST = CUSTOM_LAYOUT;
    break;
  default:
    FULL_CHARACTER_LIST = ANSI_104;
}
/**
 * Shortcuts to be shown
 *
 * @type {string[]}
 */
let shortcuts = [];

/**
 * Key for storing the highlighted shortcuts in local storage.
 *
 * @type {string}
 */
const LOCAL_STORAGE_KEY = "vivaceHighlightedShortcuts";

/**
 * Simulate a search in the dropdown, returning the list of suggestions.
 *
 * @param {string} search
 * @returns {string[]}
 */
const getSuggestions = (search) => {
  const regex = new RegExp(createAnimeSearchRegexQuery(search), "i");

  const filteredList =
    quiz.answerInput.typingInput.autoCompleteController.list.filter((anime) =>
      regex.test(anime)
    );

  filteredList.sort((a, b) => {
    return a.length - b.length || a.localeCompare(b);
  });

  return filteredList.slice(0, MAX_DROPDOWN_ITEMS);
};

/**
 * Compute all substrings of a given string.
 *
 * @param {string} str
 * @returns {string[]}
 */
const getAllSubstrings = (str) => {
  const result = [];
  for (let i = 0; i < str.length; i++) {
    for (let j = i + 1; j < str.length + 1; j++) {
      result.push(str.slice(i, j));
    }
  }
  return result;
};

/**
 * Transform a substring into a list of allowed alternative substrings that are equivalent for the search.
 *
 * @see ANIME_REGEX_REPLACE_RULES from AMQ code
 *
 * @param {string} substring
 * @returns {string[]}
 */
const mapToAlternativeSubstrings = (substring) => {
  /** @type {Set<string>} */
  const alternatives = new Set();

  // Add the AMQ replacement
  alternatives.add(
    replaceCharactersForSeachCharacters(substring).replace(
      new RegExp(DISALLOWED_SPECIAL_CHARACTERS.join("|"), "g"),
      ""
    )
  );

  // Apply mandatory replacements
  let normalized = substring.replace(/./g, (char) => {
    if (WHITELIST_CHARACTERS_INSTEAD_OF_BLACKLIST) {
        if (!FULL_CHARACTER_LIST.includes(char)) return "";
    }
    else{
        if (DISALLOWED_SPECIAL_CHARACTERS.includes(char)) return "";
    }
    if (ALLOWED_SPECIAL_CHARACTERS.includes(/** @type {any} */ (char)))
      return char;
    return NORMALIZATION_MAP[char] || char;
  });
  alternatives.add(normalized);

  // Simple alternatives
  alternatives
    .add(normalized.replace(/oo/g, "o"))
    .add(normalized.replace(/ou/g, "o"))
    .add(normalized.replace(/uu/g, "u"));

  // Find the indexes of all allowed special characters (if any)
  let specialCharIndexes = Array.from(substring)
    .map((char, index) =>
      ALLOWED_SPECIAL_CHARACTERS.includes(/** @type {any} */ (char))
        ? index
        : -1
    )
    .filter((index) => index !== -1);

  // Limit to at most 3 special characters to avoid combinatorial explosion
  if (specialCharIndexes.length > 3) {
    specialCharIndexes = specialCharIndexes.slice(0, 3);
  }

  // Generate all possible combinations of replacing special characters with spaces, using a bitmask.
  for (let i = 0; i < 1 << specialCharIndexes.length; i++) {
    let current = normalized;
    for (let j = 0; j < specialCharIndexes.length; j++) {
      if (i & (1 << j)) {
        current =
          current.substring(0, specialCharIndexes[j]) +
          " " +
          current.substring(specialCharIndexes[j] + 1);
      }
    }
    alternatives.add(current);

    // Since a single space can work for multiple spaces, we need to account for other alternatives (e.g. "a   c" can work also as "a  c" or "a c").
    while (current.includes("  ")) {
      current = current.replace("  ", " ");
      alternatives.add(current);
    }
  }

  return Array.from(alternatives);
};

/**
 * Check if str1 constains str2 as a subsequence.
 *
 * @param {string} str1 (should be longer than str2)
 * @param {string} str2
 * @returns {boolean}
 */
const supersequenceQ = (str1, str2) => {
  if (str1.length < str2.length) return false;

  let i = 0;
  let j = 0;
  while (i < str1.length && j < str2.length) {
    if (str1[i] == str2[j]) {
      j++;
    }
    i++;
  }
  return j == str2.length;
};

/**
 * Find the optimal shortcuts matching any of the targets.
 *
 * @param {string[]} targets
 * @returns
 */
const optimizedShortcuts = (targets) => {
  // Create a set of all unique substrings
  const allSubstrings = new Set(
    // Replace non printable characters with spaces
    targets
      .map((t) => t.toLocaleLowerCase())
      .flatMap(getAllSubstrings)
      .flatMap(mapToAlternativeSubstrings)
  );

  // Sort the substrings by length
  let sortedSubstrings = Array.from(allSubstrings).sort(
    (a, b) => a.length - b.length
  );

  // Filter out substrings that are too long
  sortedSubstrings = sortedSubstrings.filter(
    (substring) => substring.length <= MAX_SUBSTRING_LENGTH
  );

  let minPos = Infinity;
  let bestSubstring = "";

  /** @type {string[]} */
  let shortcuts = [];

  /** @type {string[]} */
  let altShortcuts = [];
  let currentLength = 0;
  let shortestLength = 999;

  for (let substring of sortedSubstrings) {
    const newLength = substring.length;

    // When searching for longer substrings, first pick those from the altShortcuts list
    if (newLength > currentLength) {
      altShortcuts = altShortcuts.filter((s) => {
        // Move altShortcuts of the currentLength to the shortcuts list
        if (s.length === currentLength) {
          shortcuts.push(s);
          shortestLength = shortcuts[0].length;
          return false;
        }
        // Keep the others in the altShortcuts list
        return true;
      });
      // Re-check the stopping condition after moving the altShortcuts to the shortcuts list
      if (
        shortcuts.length >= NUM_SHORTCUTS ||
        newLength > shortestLength + MAX_LENGTH_DIFFERENTIAL
      )
        break;
    }

    const suggestions = getSuggestions(substring);
    currentLength = newLength;

    const positions = targets
      .map((target) => suggestions.indexOf(target))
      .filter((pos) => pos != -1);

    if (positions.length) {
      const pos = Math.min(...positions);
      if (pos < minPos) {
        minPos = pos;
        bestSubstring = substring + "↓".repeat(pos);
      }
      substring = substring + "↓".repeat(pos);
      if (
        substring.length > MAX_SUBSTRING_LENGTH ||
        (TOP_SHORTCUTS_ONLY && pos > 0)
      ) {
        continue;
      }

      //Check if any of the current shortcuts are a subsequence of the new shortcut. (e.g. if "uron" is a shortcut, "uroun" wouldn't be added because it has the same letters in the same order + extra letters)
      const superStringQ = !FULL_SHORTCUTS
        ? shortcuts
            .concat(altShortcuts)
            .filter((s) => s.length < substring.length)
            .some((s) => supersequenceQ(substring, s))
        : false;

      if (superStringQ) continue;

      if (pos == 0) {
        shortcuts.push(substring);
        shortestLength = shortcuts[0].length;
      } else {
        altShortcuts.push(substring);
      }
    }
  }

  // If not enough shortcuts were found, try to fill with the alternative shortcuts to reach at least NUM_SHORTCUTS. When including a shortcut, ensure that all the ones with the same length are included too.
  if (altShortcuts.length > 0 && shortcuts.length < NUM_SHORTCUTS) {
    // Take at least enough to fill up to NUM_SHORTCUTS
    const neededCount = Math.min(
      NUM_SHORTCUTS - shortcuts.length,
      altShortcuts.length
    );
    const maxAltLength = altShortcuts[neededCount - 1].length;
    // Take all the altShortcuts with the same length as the longest that is needed
    shortcuts = shortcuts.concat(
      altShortcuts.filter(
        (s) =>
          s.length <=
          Math.min(maxAltLength, shortestLength + MAX_LENGTH_DIFFERENTIAL)
      )
    );
  }
  return shortcuts.length ? shortcuts : [bestSubstring];
};

/**
 * Render the shortcuts in the infoDiv.
 */
const renderShortcuts = () => {
  $(infoDiv)
    .empty()
    .append(
      $("<h5/>").html("<b>Anime shortcuts</b>"),
      ...formatShortcuts(shortcuts),
      $("<br/><br/>")
    );

  // Add event listener to the shortcuts
  $(infoDiv)
    .off("click", ".vivaceShortcut")
    .on("click", ".vivaceShortcut", function () {
      toggleHighlight($(this).data("shortcut"));
    });
};

/**
 * Compute the shortcuts when a song is played.
 *
 * @param {import('./types').AnswerResultsPayload} data
 */
const onSongPlayed = (data) => {
  const targets = [
    data.songInfo.animeNames.english,
    data.songInfo.animeNames.romaji,
    ...data.songInfo.altAnimeNames,
    ...data.songInfo.altAnimeNamesAnswers,
  ].flatMap((a) => a);

  shortcuts = optimizedShortcuts(targets);
  renderShortcuts();
};

/**
 * Toggle the highlight of a shortcut and store the state in local storage.
 *
 * @param {string | number} shortcut
 */
const toggleHighlight = (shortcut) => {
  const str = String(shortcut);

  /** @type {string[]} */
  let highlightedShortcuts = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
  );
  if (highlightedShortcuts.includes(str)) {
    highlightedShortcuts = highlightedShortcuts.filter((s) => s !== str);
  } else {
    highlightedShortcuts.push(str);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(highlightedShortcuts));
  renderShortcuts();
};

/**
 * Convert a list of shortcuts into a formatted HTML string.
 *
 * @param {string[]} shortcuts
 * @returns {JQuery<HTMLElement>[]}
 */
const formatShortcuts = (shortcuts) => {
  let uniqueShortcuts = shortcuts.filter(onlyUnique);
  let highlightedShortcuts = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
  ).map(String);

  /** @type {JQuery<HTMLElement>[]} */
  let shortcutEls = [];

  // Reorder the shortcuts so that the highlighted ones are first. Keep the order of the rest.
  uniqueShortcuts = uniqueShortcuts.sort(
    (a, b) =>
      highlightedShortcuts.includes(b) - highlightedShortcuts.includes(a)
  );
  uniqueShortcuts.forEach((shortcut) => {
    let isHighlighted = highlightedShortcuts.includes(shortcut);
    shortcutEls.push(
      $(`<code/>`, {
        class: `vivaceShortcut${isHighlighted ? " vivaceHighlighted" : ""}`,
        data: { shortcut },
      }).html(shortcut.replace(/ /g, "&nbsp;"))
    );
  });

  return shortcutEls;
};

/**
 * A filter function to keep only the unique elements in an array.
 *
 * @template T
 * @param {T} value
 * @param {number} index
 * @param {T[]} self
 * @returns {boolean}
 */
function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

/**
 * Preload dropdown when spectating, so that the shortcuts are available immediately
 */
const preloadDropdown = () => {
  if (quiz.answerInput.typingInput.autoCompleteController.list.length === 0) {
    quiz.answerInput.typingInput.autoCompleteController.updateList();
  }
};

const setupShortcuts = () => {
  const boxDiv = document.querySelector("div.qpSideContainer > div.row");

  infoDiv = $("<div/>", {
    class: "rowAnimeShortcuts",
    css: {
      overflow: "auto",
      maxHeight: "100px",
      lineHeight: "1.7",
    },
  });

  const parentDiv = boxDiv?.parentElement;
  if (!parentDiv) return;

  $(parentDiv).children().eq(4).before(infoDiv);

  new Listener("answer results", onSongPlayed).bindListener();
  new Listener("Spectate Game", (game) => {
    if (!game.inLobby) preloadDropdown();
  }).bindListener();
  new Listener("Game Starting", preloadDropdown).bindListener();
};

/**
 * Add metadata to the "Installed Userscripts" list & populate CSS
 */
const setupMetadata = () => {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  AMQ_addScriptData({
    name: "AMQ Vivace! Shortcuts",
    author: "Einlar",
    version: "1.7",
    link: "https://github.com/Einlar/AMQScripts",
    description: `
      <p>Displays 3 or more shortest dropdown shortcuts during the results phase.</p>
      <p>The shortcuts displayed are the shortest substrings of length 10 or less for which the target anime (or any of its alt names) is the first suggestion in the dropdown list (or one of the top ones, in case it is not possible to do better).</p>
      <p>Shortcuts account for romaji/english names, and exploit the AMQ replacement rules for the dropdown (for instance, an optimal shortcut for "Kaguya-sama wa Kokurasetai?: Tensai-tachi no Renai Zunousen" is "? t", because a single space can be used to match any number of consecutive special characters).</p>
      <p>A few special characters are now allowed in the shortcuts (currently any of /*=+:;-?,.!@_#). Also all the characters that AMQ does not match with a space are allowed (e.g. "°", so you can use it as a shortcut for "Gintama°")</p>
      <p>Click on a shortcut to highlight it and move it to the front of the list. The highlighed shortcuts are stored.</p>
      `,
  });

  // @ts-ignore
  // eslint-disable-next-line no-undef
  AMQ_addStyle(/*css*/ `
    .vivaceShortcut {
      cursor: pointer;
      color: white;
      background-color: #2e2c2c;
      border-width: 0.5px;
      border-style: solid;
      border-color: white;
      margin-right: 5px;
      white-space: nowrap;
      display: inline-block;
    }

    .vivaceHighlighted {
      background-color: #ffeb3b;
      color: black;
    }
  `);
};

if (window.quiz) {
  setupShortcuts();
  setupMetadata();
}
