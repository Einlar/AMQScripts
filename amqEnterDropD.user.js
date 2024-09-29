// ==UserScript==
// @name         AMQ Enter DropD
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Pressing Enter in the answer input will automatically send the value of the first suggestion in the dropdown list, or the highlighted item if any. If you don't press Enter before the guessing phase ends, this will happen automatically (except if a teammate already submitted a valid answer). Activate/deactivate with [ALT+Q].
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

/**
 * Retrieve the first suggestion in the dropdown list, given a search string.
 *
 * @param {string} search
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

const setupDropD = () => {
  $("#qpAnswerInput").on("keydown", function (event) {
    if (!active) return;

    // If the user has selected an item from the dropdown, do nothing
    if (
      quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance
        .selected
    )
      return;

    // On Enter
    if (event.which === 13) {
      const val = $(this).val();
      if (typeof val === "string" && val != "") {
        const suggestion = getSuggestions(val);

        // Avoid emptying the input if the dropdown has no items
        if (suggestion == "") return;

        // Send the answer
        $(this).val(suggestion);
        quiz.answerInput.submitAnswer(true);

        // Close the dropdown
        quiz.answerInput.activeInputController.autoCompleteController.awesomepleteInstance.close();
      }
    }
  });

  // Auto-send the answer if selected from the dropdown
  const $input = quiz.answerInput.typingInput.$input;
  $input.on("awesomplete-selectcomplete", () => {
    if (!active) return;
    const val = $input.val();
    if (typeof val === "string" && val.trim() != "") {
      quiz.answerInput.submitAnswer(true);
    }
  });

  const autoSend = new Listener("guess phase over", () => {
    if (!active) return;

    // If the current answer is not valid, and if the dropdown has items, send the first suggestion
    const currentAnswer = $("#qpAnswerInput").val();

    if (
      typeof currentAnswer === "string" &&
      currentAnswer.trim() !== "" &&
      !isValidAnime(currentAnswer)
    ) {
      // Check if any teammate has already submitted a valid answer. If so, do nothing.
      const anyOtherValidAnswer = Object.values(quiz.players)
        .filter((p) => !p.isSelf)
        .map((p) => p.avatarSlot._answer)
        .filter((a) => a !== null)
        .some((a) => isValidAnime(a));
      if (anyOtherValidAnswer) return;

      let suggestion = getSuggestions(currentAnswer);
      if (suggestion != "") {
        // Use the highlighted value from the dropdown if any
        if (
          quiz.answerInput.typingInput.autoCompleteController
            .awesomepleteInstance.isOpened
        ) {
          const highlighted =
            quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance.$ul
              .children("li")
              .filter('[aria-selected="true"]')
              .text();
          if (highlighted !== "") suggestion = highlighted;
        }

        $("#qpAnswerInput").val(suggestion);
        quiz.answerInput.submitAnswer(true);
      }
    }
  });
  autoSend.bindListener();

  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "q") {
      active = !active;
      gameChat.systemMessage(
        active
          ? "Enter DropD is Enabled. Press [ALT+Q] to disable."
          : "Enter DropD is Disabled. Press [ALT+Q] to enable."
      );
    }
  });
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setupDropD();
  }
}, 500);
