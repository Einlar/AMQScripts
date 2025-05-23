# AMQ Scripts

A growing collection of user scripts to enhance your experience on [Anime Music Quiz](https://animemusicquiz.com/).

May contain references to Hibike! Euphonium 🎺.

## How to install

1. Install a browser extension such as [Violentmonkey](https://violentmonkey.github.io/).
2. Click on the script file you want (they are the files ending with `user.js`), then click on the button `Raw`. Or just click on one of the links below. You will see the option to `Install` the script. By default, it will update automatically whenever a new version is published.

## A list of scripts

### Vivace Shortcuts - [Install](https://github.com/Einlar/AMQScripts/raw/main/amqVivaceShortcuts.user.js)

Lists optimal dropdown shortcuts after guessing phase. They are computed on the fly, so they will always be updated.

Specifically, it displays the top 3 shortest shortcut for an anime after guessing phase, defined as the shortest substring of length 10 or less for which the target anime (or any of its alt names) is the first suggestion in the dropdown list (or one of the top ones, in case it is not possible to do better). Adapted from [Tutti's version](https://github.com/tutti-amq/amq-scripts/blob/main/animeShortcuts.user.js).

### Hot Potato Gamemode - [Install](https://github.com/Einlar/AMQScripts/raw/main/hotPotato.user.js)

A collection of utilities for the [hot potato custom gamemode](https://pastebin.com/qdr4g6Jp).

- Alt+click on a teammate's avatar to pass the potato to them.
- `/potato rules`: link the pastebin with the rules
- `/potato roll`: randomly assign a player of each team to have the potato before starting a game
- `/potato track` (experimental): enable/disable auto-tracking of the potato (experimental). If enabled, at the start of each round, the script will autothrow a message showing who currently has the potato. You will need to manually tell the script who has the potato using ALT+click. If exactly one player gives a valid answer, and you have not manually passed the potato, the script will automatically do it for you.

### Enter Dropdown - [Install](https://github.com/Einlar/AMQScripts/raw/main/amqEnterDropD.user.js)

A faster way to pick an item from the dropdown, useful for playing in impossible rooms like 2+0.

- Pressing Enter in the answer input will automatically send the value of the first suggestion in the dropdown list, or the highlighted item if any.
- If you don't press Enter before the guessing phase ends, this will happen automatically (except if a teammate already submitted a valid answer).
- Activate/deactivate with `ALT + Q` (starts deactivated).

### May The Sample Go On - [Install](https://github.com/Einlar/AMQScripts/raw/main/amqMayTheSampleGoOn.user.js)

Prevents the sample from restarting when guess phase ends. Updated from [Mxyuki's version](https://github.com/Mxyuki/AMQ-Scripts/blob/main/amqNoSampleReset.user.js).

## Developer Instructions

- Just run `npm install` to install some dev dependencies (types & [eslint](https://eslint.org/)).
- I use [JSDoc](https://jsdoc.app/) to add type checking to all the scripts while avoiding the hassle of setting up Typescript and compiling every time (and developing in JS with no types is doomed). It should work immediately in any modern editor (I personally use [VSC](https://code.visualstudio.com/) on [WSL](https://learn.microsoft.com/en-us/windows/wsl/install)). With types you get nice intellisense suggestions like these:

  ![An example of intellisense in VSC](./images/intellisense_example.png)

  Types are by no means complete - I merely add only the stuff I use. But, I plan to expand them, _eventually_.
