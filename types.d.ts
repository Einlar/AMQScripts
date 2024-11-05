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

  /** @see https://animemusicquiz.com/scripts/pages/gamePage/game/quiz/quizInfoContainer.js */
  infoContainer: {
    currentSongNumber: number;
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
      awesomepleteInstance: {
        selected: boolean;
        isOpened: boolean;
        $ul: JQuery<HTMLUListElement>;
      };
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
};

declare class Lobby {
  /**
   * Whether the user is currently in the lobby
   */
  inLobby: boolean;

  settings: {
    gamemode: Gamemode;
  };

  players: Record<number, Player>;
}

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
  multipleChoice: boolean;
  quizDescription: {
    quizId: string;
    startTime: string;
    roomName: string;
  };
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
  songInfo: SongInfo;
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

export type Guess = {
  bestGuess: string;
  bestScore: number;
};

export type Stats = {
  songName: Guess;
  group?: Guess;
  artists: Guess[];
};

export type ChatMessagePayload = {
  emojis: any;
  message: string;
  modMessage: boolean;
  sender: string;
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
    command: "chat message",
    callback: (data: ChatMessagePayload) => void
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

class ChatBoxClass {
  writeMessage: (
    sender: string,
    msg: string,
    emojis: any,
    allowHtml: boolean
  ) => void;
}

declare global {
  var gameChat: GameChat;
  var quiz: Quiz;
  var lobby: Lobby;
  var Listener: typeof ListenerClass;
  var socket: AMQSocket;

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

  var ChatBox: typeof ChatBoxClass;
}

declare class GameChat {
  systemMessage: (message: string) => void;
}
