// ==UserScript==
// @name         AMQ Ranked Tracker
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Track which days you played ranked games, and your score for that day. Access the data in the AMQ settings menu, under "Ranked Tracker".
// @author       Einlar
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/Einlar/AMQScripts/raw/main/amqRankedTracker.user.js
// @updateURL    https://github.com/Einlar/AMQScripts/raw/main/amqRankedTracker.user.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @grant        none
// @icon         https://i.imgur.com/o8hOqsv.png
// ==/UserScript==

const regionDictionary = /** @type {const} */ ({
  E: "Eastern",
  C: "Central",
  W: "Western",
});

const setupMetadata = () => {
  AMQ_addScriptData({
    name: "AMQ Ranked Tracker",
    author: "Einlar",
    version: "0.1",
    link: "https://github.com/Einlar/AMQScripts",
    description:
      "<p>Tracks which days you played ranked games and your score for that day.</p>",
  });
};

/**
 * Create a dictionary that automatically persists in localStorage, with an optional validator.
 *
 * @template {{}} T
 * @param {string} storageKey - The key to use in localStorage.
 * @param {(data: any) => T} [validator] - A function to validate and transform the loaded data.
 * @returns {T} - A proxy object that auto-saves to localStorage.
 */
function createPersistentDictionary(storageKey, validator) {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    data = {};
  }

  data = validator ? validator(data) : /** @type {T} */ (data);

  const dictionary = new Proxy(data, {
    set(target, key, value) {
      target[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(target));
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      localStorage.setItem(storageKey, JSON.stringify(target));
      return true;
    },
  });

  return dictionary;
}

/**
 * Compute the key for the current ranked game
 *
 * @example "2024-01-30 C Expert"
 */
const rankedKey = () => {
  const region = $("#mpRankedTimer h3").text() || "";
  const type = hostModal.$roomName.val()?.includes("Expert")
    ? "Expert"
    : "Novice";

  return `${new Date().toISOString().split("T")[0]} ${region} ${type}`;
};

/**
 * @typedef RankedHistoryKey
 * @property {string} date - The date in YYYY-MM-DD format.
 * @property {keyof regionDictionary} region - The region of the game.
 * @property {string} type - The type of ranked (e.g. "Expert").
 */

/**
 * Parse the ranked key into its components. Returns undefined if the key is invalid.
 *
 * @param {string} key
 * @returns {RankedHistoryKey | undefined}
 */
const parseRankedKey = (key) => {
  const [date, region, type] = key.split(" ");
  if (!date || !region || !type) return;

  // Check if date is in the correct format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  // Check if region is valid
  if (!Object.keys(regionDictionary).includes(region)) return;

  return /** @type {RankedHistoryKey} */ ({ date, region, type });
};

const setupScript = () => {
  /** @type {Record<string, number>} */
  const rankedHistory = createPersistentDictionary(
    "amqRankedTracker",
    (data) => {
      if (typeof data !== "object") return {};

      // Remove invalid data
      for (const key in data) {
        if (!parseRankedKey(key)) delete data[key];
        if (typeof data[key] !== "number") delete data[key];
      }

      return data;
    }
  );

  new Listener("answer results", (payload) => {
    if (quiz.inQuiz && quiz.gameMode === "Ranked") {
      const myGamePlayerId = playerId();
      if (myGamePlayerId === undefined) return;

      const myScore = Object.values(payload.players).find(
        (p) => p.gamePlayerId === myGamePlayerId
      )?.score;
      const key = rankedKey();
      if (myScore !== undefined) rankedHistory[key] = myScore;
    }
  }).bindListener();

  // Add a button in the settings
  $("#optionListSettings").before(
    /*html*/ `<li class="clickAble" onclick="$('#rankedTrackerModal').modal('show');">Ranked Tracker</li>`
  );

  // Add some way to visualize the stored data (& personal best)
  $("#gameContainer").append(
    $(/*html*/ `
    <div class="modal fade tab-modal" id="rankedTrackerModal" tabIndex="-1" role="dialog" aria-labelledby="rankedTrackerModalLabel" aria-hidden="true">
      <div class="modal-dialog" role="document" style="width: 680px">
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            <h4 class="modal-title">Ranked Tracker</h4>
            <div class="tabContainer">
              <div id="rtHistoryTab" class="tab clickAble selected">
                <h5>History</h5>
              </div>
              <div id="rtStatsTab" class="tab clickAble">
                <h5>Stats</h5>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body" style="overflow-y: auto; max-height: calc(100vh - 150px);">
            <div id="rtHistoryContainer">
              <div id="rankedTrackerContent"></div>
            </div>
            <div id="rtStatsContainer">
              <div id="rankedTrackerStats"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    `)
  );

  const tabs = /** @type {const} */ (["rtHistory", "rtStats"]);

  /**
   * Switch to a different tab in the settings modal
   *
   * @param {tabs[number]} tab
   */
  const switchTab = (tab) => {
    tabs.forEach((t) => {
      if (t === tab) {
        $(`#${t}Tab`).addClass("selected");
        $(`#${t}Container`).show();
      } else {
        $(`#${t}Tab`).removeClass("selected");
        $(`#${t}Container`).hide();
      }
    });
  };

  tabs.forEach((tab) => {
    $(`#${tab}Tab`).on("click", () => switchTab(tab));
  });

  switchTab("rtHistory");

  const rankedTrackerContent = $("#rankedTrackerContent");

  /**
   * Render the ranked history within the modal.
   */
  const renderRankedHistory = () => {
    let currentMonth = new Date();
    renderCalendar(currentMonth);
  };

  /**
   * Show a simple calendar view with rows for each week, columns for each day, and cells for each day. Each cell should show the scores for each day, for each region (e.g. "E: 10"). Regions without a score in a cell should not be shown to save space. There are arrows to navigate between months.
   * In the header, show the month and year.
   *
   * @param {Date} monthDate The date to render the calendar for.
   */
  const renderCalendar = (monthDate) => {
    rankedTrackerContent.empty();

    // Header with month and year, and navigation arrows
    const header = $(
      '<div style="text-align: center; margin-bottom: 10px;"></div>'
    );
    const prevButton = $(
      '<button class="btn-icon" style="margin-right: 10px;">&lt;</button>'
    );
    const nextButton = $(
      '<button class="btn-icon" style="margin-left: 10px;">&gt;</button>'
    );
    const monthYear = $(
      '<span style="font-size: 18px; font-weight: bold;"></span>'
    );

    monthYear.text(
      monthDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      })
    );
    header.append(prevButton, monthYear, nextButton);
    rankedTrackerContent.append(header);

    // Event handlers for navigation
    prevButton.on("click", () => {
      monthDate.setMonth(monthDate.getMonth() - 1);
      renderCalendar(monthDate);
    });

    nextButton.on("click", () => {
      monthDate.setMonth(monthDate.getMonth() + 1);
      renderCalendar(monthDate);
    });

    // Days of the week header
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const calendarTable = $(
      '<table style="width: 100%; border-collapse: collapse;"></table>'
    );
    const headerRow = $("<tr></tr>");
    daysOfWeek.forEach((day) => {
      headerRow.append(
        $(
          '<th style="border: 1px solid var(--accentColor, initial); padding: 5px;">'
        ).text(day)
      );
    });
    calendarTable.append(headerRow);

    // Get the first day of the month
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startingDay = firstDay.getDay();

    // Number of days in the month
    const daysInMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    ).getDate();

    // Create the calendar rows
    let date = 1;
    for (let i = 0; i < 6; i++) {
      // maximum 6 weeks
      let row = $("<tr></tr>");
      for (let j = 0; j < 7; j++) {
        let cell = $(
          '<td style="border: 1px solid var(--primaryColorContrast, initial); height: 80px; vertical-align: top; padding: 2px;"></td>'
        );
        if (i === 0 && j < startingDay) {
          // Empty cell before first day of month
          row.append(cell);
        } else if (date > daysInMonth) {
          // Empty cells after last day of month
          row.append(cell);
        } else {
          // Display the date
          const cellContent = $("<div></div>");
          cellContent.append($('<div style="font-weight: bold;">').text(date));

          // Check for scores on this date
          const dateString = `${monthDate.getFullYear()}-${String(
            monthDate.getMonth() + 1
          ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
          let hasScores = false;
          for (const key in rankedHistory) {
            const parsedKey = parseRankedKey(key);
            if (parsedKey && parsedKey.date === dateString) {
              hasScores = true;
              const regionShort = parsedKey.region;
              const score = rankedHistory[key];
              cellContent.append(
                $(
                  /*html*/ `<div style="color: ${
                    parsedKey.type === "Expert"
                      ? "var(--wrongAnswerColor, rgb(134, 0, 0))"
                      : "var(--correctAnswerColor, rgb(0, 0, 0))"
                  }">`
                ).text(`${regionShort}: ${score}`)
              );
            }
          }

          // if (hasScores) {
          //   cell.css("background-color", "var(--accentColor, initial)"); // Highlight cells with scores
          // }

          cell.append(cellContent);
          row.append(cell);
          date++;
        }
      }
      calendarTable.append(row);

      if (date > daysInMonth) {
        break; // Stop creating rows if we've reached the end
      }
    }

    rankedTrackerContent.append(calendarTable);
  };

  const renderStats = () => {
    const rankedTrackerStats = $("#rankedTrackerStats");
    rankedTrackerStats.empty();

    // Find highest score and most recent date
    let highestScore = 0;
    let mostRecentDate = "";

    for (const key in rankedHistory) {
      const score = rankedHistory[key];
      if (score > highestScore) {
        highestScore = score;
        mostRecentDate = parseRankedKey(key)?.date || "";
      } else if (score === highestScore && key > mostRecentDate) {
        mostRecentDate = parseRankedKey(key)?.date || "";
      }
    }

    // Calculate days ago
    const daysAgo = mostRecentDate
      ? Math.floor(
          (new Date().getTime() - new Date(mostRecentDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    // Create stats box
    const statsBox = $(/*html*/ `
  <div style="border: 1px solid var(--primaryColorContrast, initial); padding: 10px; margin: 10px;">
    <h4>Personal Best</h4>
    <p>Highest Score: ${highestScore}</p>
    <p>Achieved on: ${mostRecentDate}</p>
    <p>(${daysAgo} days ago)</p>
  </div>
`);

    rankedTrackerStats.append(statsBox);
  };

  // Initial render
  renderRankedHistory();

  // Update each time the modal is shown
  $("#rankedTrackerModal").on("shown.bs.modal", () => {
    renderRankedHistory();
    renderStats();
  });
};

/**
 * Retrieve the ID of the player
 */
const playerId = () =>
  Object.values(quiz.players).find((p) => p.isSelf)?.gamePlayerId;

/**
 * Setup the script
 *
 * @returns {Promise<void>}
 */
const waitForInitialLoad = () => {
  return new Promise((resolve, reject) => {
    if (!quiz) return reject(new Error("Quiz not found"));

    const loadingScreen = document.getElementById("loadingScreen");
    if (!loadingScreen) return reject(new Error("Loading screen not found"));

    new MutationObserver((_record, observer) => {
      try {
        observer.disconnect();
        resolve();
      } catch (error) {
        observer.disconnect();
        reject(error);
      }
    }).observe(loadingScreen, { attributes: true });
  });
};

/**
 * Validate a state object
 */

waitForInitialLoad().then(() => {
  setupMetadata();
  setupScript();
});
