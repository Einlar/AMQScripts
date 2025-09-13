// ==UserScript==
// @name         AMQ Enter DropD
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Pressing Enter in the answer input will automatically send the value of the first suggestion in the dropdown list, or the highlighted item if any. If you don't press Enter before the guessing phase ends, this will happen automatically (except if you or any teammate already submitted a valid answer). Activate/deactivate with [ALT+Q].
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/amqEnterDropD.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/amqEnterDropD.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 *
 * v1.9
 * - Update the script to match the latest dropdown logic, which ignores apostrophes when searching for suggestions.
 *   (For instance, "Girls Last" now matches "Girls' Last Tour")
 * - Refactor the code a bit to make it more readable if I ever need to edit it again in like six months.
 *
 * v1.8
 * - Avoid sending the answer when guess phase ends if it was already submitted before (as this would just mess the timing).
 *
 * v1.7
 * - If the player already submitted a valid answer, avoid replacing it with the first item from the dropdown (or the highlighted one).
 * - When guessing phase ends, if the current answer is valid but has not been submitted yet, submit it.
 *
 * v1.6
 * - Make the script work also on AMQ subdomains (since at the moment the main AMQ domain is not working).
 *
 * v1.5
 * - The answer is automatically sent also when it is selected from the dropdown list.
 */

/**
 * Is the script active?
 * @type {boolean}
 */
let active = false;

// Constants
/** @type {number} */
const ENTER_KEY_CODE = 13;
/** @type {number} */
const LOADING_CHECK_INTERVAL = 500;
/** @type {{alt: boolean, key: string}} */
const TOGGLE_SHORTCUT = { alt: true, key: "q" };

/**
 * Retrieve the first suggestion in the dropdown list, given a search string.
 *
 * @param {string} search
 */
const getSuggestions = (search) => {
  const regex = new RegExp(createAnimeSearchRegexQuery(search), "i");

  const filteredList =
    quiz.answerInput.typingInput.autoCompleteController.list.filter((anime) => {
      // First, try matching the anime title as-is
      if (regex.test(anime)) {
        return true;
      }

      // If no match and the title contains an apostrophe, try matching without it
      if (anime.includes("'")) {
        const animeWithoutApostrophe = anime.replace("'", "");
        return regex.test(animeWithoutApostrophe);
      }

      return false;
    });

  // Sort by length first, then alphabetically
  filteredList.sort((a, b) => {
    return a.length - b.length || a.localeCompare(b);
  });

  return filteredList[0] || "";
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
 * Check if any teammate has already submitted a valid answer.
 *
 * @returns {boolean}
 */
const hasTeammateSubmittedValidAnswer = () => {
  return Object.values(quiz.players)
    .filter((p) => !p.isSelf)
    .map((p) => p.avatarSlot._answer)
    .filter((a) => a !== null)
    .some((a) => isValidAnime(a));
};

/**
 * Get the highlighted suggestion from the dropdown if any.
 *
 * @returns {string}
 */
const getHighlightedSuggestion = () => {
  if (
    !quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance
      .isOpened
  ) {
    return "";
  }

  const highlighted =
    quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance.$ul
      .children("li")
      .filter('[aria-selected="true"]')
      .text();

  return highlighted || "";
};

/**
 * Submit an answer and close the dropdown.
 *
 * @param {string} answer - The answer to submit
 */
const submitAnswerAndClose = (answer) => {
  $("#qpAnswerInput").val(answer);
  quiz.answerInput.submitAnswer(true);

  // Close the dropdown
  quiz.answerInput.activeInputController.autoCompleteController.awesomepleteInstance.close();
};

/**
 * Handle auto-completion selection.
 */
const handleAutoCompleteSelection = () => {
  if (!active) return;

  const val = quiz.answerInput.typingInput.$input.val();
  if (typeof val === "string" && val.trim() !== "") {
    quiz.answerInput.submitAnswer(true);
  }
};

/**
 * Handle the end of the guess phase.
 */
const handleGuessPhaseOver = () => {
  if (!active) return;

  const currentAnswer = $("#qpAnswerInput").val();

  // If the current answer is valid, submit it if it wasn't already submitted
  if (
    typeof currentAnswer === "string" &&
    isValidAnime(currentAnswer) &&
    getLastSubmittedAnswer() !== currentAnswer
  ) {
    quiz.answerInput.submitAnswer(true);
    return;
  }

  // If the current answer is not valid, but you have already submitted a valid answer, do nothing
  if (isValidAnime(getLastSubmittedAnswer() ?? "")) return;

  // If the current answer is not valid, and if the dropdown has items, send the first suggestion
  if (
    typeof currentAnswer === "string" &&
    currentAnswer.trim() !== "" &&
    !isValidAnime(currentAnswer)
  ) {
    // Check if any teammate has already submitted a valid answer. If so, do nothing.
    if (hasTeammateSubmittedValidAnswer()) return;

    let suggestion = getSuggestions(currentAnswer);
    if (suggestion !== "") {
      // Use the highlighted value from the dropdown if any
      const highlighted = getHighlightedSuggestion();
      if (highlighted !== "") {
        suggestion = highlighted;
      }

      submitAnswerAndClose(suggestion);
    }
  }
};

/**
 * Handle script toggle shortcut.
 *
 * @param {KeyboardEvent} e - The keyboard event
 */
const handleToggleShortcut = (e) => {
  if (e.altKey && e.key === TOGGLE_SHORTCUT.key) {
    active = !active;
    gameChat.systemMessage(
      active
        ? "Enter DropD is Enabled. Press [ALT+Q] to disable."
        : "Enter DropD is Disabled. Press [ALT+Q] to enable."
    );
  }
};

/**
 * Set up all event listeners and initialize the script.
 */
const setupDropD = () => {
  // Handle Enter key press in answer input
  $("#qpAnswerInput").on("keydown", function (event) {
    if (!active) return;

    // If the user has selected an item from the dropdown, do nothing
    if (
      quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance
        .selected
    ) {
      return;
    }

    // On Enter
    if (event.which === ENTER_KEY_CODE) {
      const val = $(this).val();
      if (typeof val === "string" && val !== "") {
        const suggestion = getSuggestions(val);

        // Avoid emptying the input if the dropdown has no items
        if (suggestion === "") return;

        // Send the answer and close dropdown
        submitAnswerAndClose(suggestion);
      }
    }
  });

  // Auto-send the answer if selected from the dropdown
  const $input = quiz.answerInput.typingInput.$input;
  $input.on("awesomplete-selectcomplete", handleAutoCompleteSelection);

  // Handle guess phase ending
  const autoSend = new Listener("guess phase over", handleGuessPhaseOver);
  autoSend.bindListener();

  // Handle toggle shortcut
  document.addEventListener("keydown", handleToggleShortcut);
};

/**
 * Initialize the script after AMQ has loaded.
 */
const initializeScript = () => {
  let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
      clearInterval(loadInterval);
      setupDropD();
    }
  }, LOADING_CHECK_INTERVAL);
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
initializeScript();
