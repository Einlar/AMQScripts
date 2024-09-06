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

  skipController: {
    voteSkip: () => void;
  };

  players: Record<number, Player>;

  setupQuiz: (...args: any[]) => void;
}

export type Player = {
  name: string;
  gamePlayerId: number;
  isSelf: boolean;
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
}

export class ListenerClass {
  constructor(command: string, callback: (data: any) => void);
  fire: (payload: any) => void;
  bindListener: () => void;
  unbindListener: () => void;
}

export type AMQSocket = {
  sendCommand: (params: { type: string; command: string; data: any }) => void;
};

declare global {
  var quiz: Quiz;
  var lobby: Lobby;
  var Listener: typeof ListenerClass;
  var socket: AMQSocket;
}
