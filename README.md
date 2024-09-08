# AMQ Scripts

A growing collection of user scripts to enhance your experience on [Anime Music Quiz](https://animemusicquiz.com/).

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
