// ==UserScript==
// @name         AMQ Vivace! Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Displays the top 3 shortest shortcut for an anime after guessing phase, defined as the shortest substring of length 10 or less for which the target anime (or any of its alt names) is the first suggestion in the dropdown list (or one of the top ones, in case it is not possible to do better). Adapted from https://github.com/tutti-amq/amq-scripts/blob/main/animeShortcuts.user.js
// @author       Einlar, Tutti
// @match        https://animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/amqVivaceShortcuts.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/amqVivaceShortcuts.user.js
// @grant        none
// ==/UserScript==

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
 * Number of shortcuts to display.
 */
const NUM_SHORTCUTS = 3;

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
 * Find the optimal shortcuts matching any of the targets.
 *
 * @param {string[]} targets
 * @returns
 */
const optimizedShortcuts = (targets) => {
  // Create a set of all unique substrings
  const allSubstrings = new Set(
    // Replace non printable characters with spaces
    targets.map((t) => t.replace(/[^ -~]/g, " ")).flatMap(getAllSubstrings)
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
  let shortcuts = [];

  for (const substring of sortedSubstrings) {
    const suggestions = getSuggestions(substring);

    const positions = targets
      .map((target) => suggestions.indexOf(target))
      .filter((pos) => pos != -1);

    if (positions.length) {
      const pos = Math.min(...positions);
      if (pos < minPos) {
        minPos = pos;
        bestSubstring = substring;
      }

      // If a perfect shortcut is found, append it to the results
      if (pos === 0) {
        shortcuts.push(substring);
        if (shortcuts.length >= NUM_SHORTCUTS) {
          break;
        }
      }
    }
  }

  return shortcuts.length ? shortcuts : [bestSubstring];
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
  ].flatMap((a) => a);

  const shortcuts = optimizedShortcuts(targets);

  infoDiv.innerHTML = `<h5><b>Anime shortcuts: </b></h5>${formatShortcuts(
    shortcuts
  )}<br><br>`;
};

const formatShortcuts = (shortcuts) => {
  let uniqueShortcuts = shortcuts.filter(onlyUnique);
  let formattedString = "";
  uniqueShortcuts.forEach((shortcut) => {
    let formattedShortcut = shortcut.includes(" ")
      ? shortcut.replaceAll(" ", "&nbsp")
      : shortcut;
    formattedString += `<code style = "color:white;background-color:#2e2c2c;border-width:0.5px;border-style:solid;border-color:white">${formattedShortcut}</code> `;
  });

  return formattedString;
};

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

const setupShortcuts = () => {
  const boxDiv = document.querySelector("div.qpSideContainer > div.row");
  infoDiv = document.createElement("div");

  infoDiv.className = "rowAnimeShortcuts";
  infoDiv.style.cssText += "line-height: 1.7";

  const parentDiv = boxDiv?.parentElement;
  parentDiv?.insertBefore(infoDiv, parentDiv?.children[4]);

  new Listener("answer results", onSongPlayed).bindListener();
};

if (window.quiz) {
  setupShortcuts();
}
