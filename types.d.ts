import videojs from "videojs";

export {};

declare class Quiz {
  /**
   * Whether the user is currently in a quiz
   */
  inQuiz: boolean;

  /**
   * Whether the user is spectating a quiz
   */
  isSpectator?: boolean;

  /**
   * The input object for the quiz answer
   */
  answerInput: QuizAnswerInput;

  gameMode: Gamemode;
  teamMode: boolean;

  skipController: {
    voteSkip: () => void;
  };

  /**
   * Dictionary of player number to player object
   */
  players: Record<number, Player>;

  setupQuiz: (...args: any[]) => void;

  quizDescription: {
    /** Quiz UUID */
    quizId: string;
    roomName: string;
    /** Date in ISO-8601 format */
    startTime: string;
  };
}

declare class QuizAnswerInput {
  submitAnswer: (showState: boolean) => void;
  typingInput: {
    $input: JQuery<HTMLInputElement>;
    quizAnswerState: {
      currentAnswer: string | null;
    };
    autoCompleteController: {
      updateList: () => void;
      list: string[];
      awesomepleteInstance: AmqAwesomepleteClass;
    };
  };
  activeInputController: {
    autoCompleteController: {
      awesomepleteInstance: {
        close: () => void;
      };
    };
  };
}

export type Player = {
  name: string;
  answer: string;
  gamePlayerId: number;
  isSelf: boolean;
  teamNumber: null | number;
  avatarSlot: {
    _answer: string | null;
    $body: JQuery<HTMLDivElement>;
  };
  startPositionSlot: number;
};

export type LobbyPlayer = {
  name: string;
  host: boolean;
  ready: boolean;
  avatarInfo: any;
  gamePlayerId: number;
  level: number;
  lobbySlot: {
    $TEAM_DISPLAY_TEXT: JQuery<HTMLHeadingElement>;
  };
};

declare class Lobby {
  /**
   * Whether the user is currently in the lobby
   */
  inLobby: boolean;

  settings: GameSettings;

  players: Record<number, LobbyPlayer>;
}

export type GameSettings = {
  gamemode: Gamemode;
  teamSize: number;
};

export type Gamemode = "Ranked" | "Multiplayer" | "Solo";

export type GameChatUpdatePayload = {
  messages: MessagePayload[];
};

export type MessagePayload = {
  sender: string;
  modMessage: boolean;
  message: string;
  teamMessage: boolean;
  messageId: number;
  // emojis, badges, etc.
};

export type GameStartingPayload = {
  showSelection: number;
  players: any[];
  groupSlotMap: Record<string, number[]>;
  multipleChoiceEnabled: boolean;
  quizIdentifier: any;
  gameMode: Gamemode;
};

export type QuizOverPayload = {
  gameId: number;
  settings: any;
  hostName: string;
  playersInQueue: string[];
  players: any[];
  inLobby: boolean;
  mapOfFullTeams: Record<number, boolean>;
  spectators: any[];
  numberOfTeams: number;
};

export type TeamMemberAnswerPayload = {
  answer: string;
  gamePlayerId: number;
};

export type AnswerResultsPayload = {
  players: Record<number, PlayerResults>;
  progressBarState: {
    length: number;
    played: number;
  };
  groupMap: Record<number, number>;
  songInfo: SongInfo;
  watched: boolean;
  likedState: number;
};

export type PlayerAnswersPayload = {
  answers: {
    gamePlayerId: number;
    pose: number;
    answer: string;
  }[];
  progressBarState: any;
};

export type PlayerResults = {
  gamePlayerId: number;
  pose: number;
  level: number;
  correct: boolean;
  score: number;
  listStatus: number;
  showScore: number;
  listNumber: number;
  position: number;
  positionSlot: number;
};

export type SpectateGamePayload = {
  hostName: string;
  inLobby: boolean;
};

export type SongInfo = {
  songName: string;
  artist: string;
  animeNames: AnimeNames;
  videoTargetMap: VideoMap;
  altAnimeNames: string[];
  type: number;
  annId: number;
  highRisk: number;
  animeScore: number;
  animeType: string;
  vintage: string;
  animeDifficulty: number;
  animeTags: string[];
  animeGenre: string[];
  altAnimeNames: string[];
  altAnimeNamesAnswers: string[];
  siteIds: {
    annId: number;
    malId: number;
    kitsuId: number;
    aniListId: number;
  };
  artistInfo: Artist | Group;
};

export class ListenerClass {
  constructor(
    command: "game chat update",
    callback: (data: GameChatUpdatePayload) => void
  );
  constructor(command: "play next song", callback: (data: any) => void);
  constructor(
    command: "Game Starting",
    callback: (data: GameStartingPayload) => void
  );
  constructor(command: "quiz over", callback: (data: QuizOverPayload) => void);
  constructor(command: "guess phase over", callback: () => void);
  constructor(
    command: "team member answer",
    callback: (data: TeamMemberAnswerPayload) => void
  );
  constructor(
    command: "answer results",
    callback: (data: AnswerResultsPayload) => void
  );
  constructor(
    command: "Spectate Game",
    callback: (data: SpectateGamePayload) => void
  );
  constructor(
    command: "player answers",
    callback: (data: PlayerAnswersPayload) => void
  );
  fire: (payload: any) => void;
  bindListener: () => void;
  unbindListener: () => void;
}

export type AMQSocket = {
  sendCommand: (params: { type: string; command: string; data: any }) => void;
};

/**
 *  sendCommand: (params: {
    type: "lobby";
    command: "game chat message";
    data: { msg: string; teamMessage: boolean };
  }) => void;

  
  sendCommand: (params: {
    type: "quiz";
    command: "quiz answer";
    data: { answer: string };
  }) => void;
 */

declare class QuizVideoController {
  getCurrentVideoUrl: () => string | null;

  getCurrentPlayer: () => MoePlayer;

  /**
   * Function called to play the next video in the quiz
   */
  playNextVideo: () => void;

  moePlayers: MoePlayer[];
}

declare class MoePlayer {
  player: videojs.Player;
  replayVideo: () => void;
  lastSeenTime: number;
  $player: JQuery<HTMLVideoElement>;
  videoMap: {
    catbox?: {
      "0"?: string;
      "480"?: string;
      "720"?: string;
    };
    openingsmoe?: {
      "480"?: string;
      "720"?: string;
    };
  };
}

/**
 * @see https://socket.animemusicquiz.com/scripts/pages/gamePage/gameSettings/hostModal.js
 */
export class HostModal {
  displayHostSolo: () => void;
  $roomName: JQuery<HTMLInputElement>;
  getSettings: () => any;
}

type Suggestion = {
  label: string;
  value: string;
};

/**
 * Base Awesomeplete class interface
 */
declare class AwesompleteClass {
  constructor(input: HTMLInputElement, options?: any);
  ul: HTMLUListElement;
  input: HTMLInputElement;
  minChars: number;
  maxItems: number;
  sort: boolean | ((a: any, b: any) => number);
  data: (item: any, input?: string) => any;
  filter: (text: any, input: string) => boolean;
  suggestions: Suggestion[];
  index: number;
  status: HTMLElement;
  count: number;

  goto(i: number): void;
  open(): void;
  close(options?: { reason?: string }): void;
  item(text: any, input: string, item_id: number): HTMLLIElement;
  evaluate(): void;
}

/**
 * Suggestion class used by Awesomeplete
 */
declare class SuggestionClass {
  constructor(data: string | string[] | { label: string; value: string });
  label: string;
  value: string;
  length: number;
  toString(): string;
  valueOf(): string;
}

/**
 * Enhanced Awesomeplete class with AMQ-specific functionality
 */
declare class AmqAwesomepleteClass extends AwesompleteClass {
  constructor(input: HTMLInputElement, options: any, scrollable?: boolean);

  searchId: number;
  currentSubList: any[] | null;
  letterLists: Record<string, any[]>;
  currentQuery: string;
  isOpened: boolean;
  selected: boolean;
  $ul: JQuery<HTMLUListElement>;
  _list: any[];

  evaluate(): void;
  hide(): void;
  goto(i: number): void;
  item(text: any, input: string, item_id: number): HTMLLIElement;
}

/**
 * Global escapeHtml function used by AmqAwesomeplete
 */
declare function escapeHtml(text: string): string;

declare global {
  var gameChat: GameChat;
  var quiz: Quiz;
  var lobby: Lobby;
  var Listener: typeof ListenerClass;
  var socket: AMQSocket;
  var quizVideoController: QuizVideoController;

  /**
   * The name of the user
   */
  var selfName: string;

  /**
   * Transform a search string into a regex for the dropdown list
   */
  var createAnimeSearchRegexQuery: (search: string) => RegExp;

  /**
   * Replace special characters in an anime name with their normal counterparts that can be used in the dropdown search
   * (yeah it is "Seach" in the original code :D)
   */
  var replaceCharactersForSeachCharacters: (inputString: string) => string;

  var AMQ_addScriptData: (metadata: {
    name?: string;
    author?: string;
    version?: string;
    link?: string;
    description?: string;
  }) => void;

  var AMQ_addStyle: (css: string) => void;

  var hostModal: HostModal;

  /**
   * Base Awesomeplete class
   */
  var Awesomplete: AwesompleteClass;

  /**
   * Enhanced Awesomeplete class with AMQ-specific functionality
   */
  var AmqAwesomeplete: typeof AmqAwesomepleteClass;

  /**
   * Suggestion class used by Awesomeplete
   */
  var Suggestion: typeof SuggestionClass;

  /**
   * Global escapeHtml function used by AmqAwesomeplete
   */
  var escapeHtml: (text: string) => string;
}

declare class GameChat {
  systemMessage: (message: string) => void;
}
