import { TAVERN_QUIZ_MAX_PAYOUT, TAVERN_QUIZ_MAX_STAKE } from "@blockcraft/protocol";
import { TOWN_TAVERN_QUIZ_TABLE_POSITION } from "@blockcraft/voxel-world";

type Question = { id: string; prompt: string; choices: readonly [string, string, string, string]; answer: string };
const QUESTIONS: readonly Question[] = [
  { id: "cube", prompt: "How many faces does a cube have?", choices: ["4", "6", "8", "12"], answer: "6" },
  { id: "east", prompt: "Which compass direction is opposite east?", choices: ["North", "South", "West", "Northeast"], answer: "West" },
  { id: "dozen", prompt: "How many make a dozen?", choices: ["10", "11", "12", "20"], answer: "12" },
  { id: "hour", prompt: "How many minutes are in one hour?", choices: ["30", "45", "60", "90"], answer: "60" },
  { id: "octagon", prompt: "How many sides does an octagon have?", choices: ["6", "7", "8", "9"], answer: "8" },
  { id: "seven", prompt: "What is seven times eight?", choices: ["48", "54", "56", "64"], answer: "56" },
  { id: "triangle", prompt: "What is the sum of a triangle's interior angles?", choices: ["90°", "180°", "270°", "360°"], answer: "180°" },
  { id: "leap", prompt: "How many days are in a leap year?", choices: ["364", "365", "366", "367"], answer: "366" },
  { id: "kilogram", prompt: "How many grams make a kilogram?", choices: ["100", "500", "1000", "10,000"], answer: "1000" },
  { id: "roman", prompt: "What number does the Roman numeral X represent?", choices: ["5", "10", "50", "100"], answer: "10" },
  { id: "square", prompt: "How many equal sides does a square have?", choices: ["2", "3", "4", "5"], answer: "4" },
  { id: "planet", prompt: "Which planet is the largest in our solar system?", choices: ["Earth", "Mars", "Jupiter", "Saturn"], answer: "Jupiter" },
  { id: "power", prompt: "What is two to the fifth power?", choices: ["16", "25", "32", "64"], answer: "32" },
  { id: "chess", prompt: "Which chess piece moves in an L shape?", choices: ["Bishop", "Knight", "Rook", "Queen"], answer: "Knight" },
  { id: "orbit", prompt: "What does Earth orbit?", choices: ["The Moon", "Mars", "The Sun", "Jupiter"], answer: "The Sun" },
  { id: "pair", prompt: "How many objects make a pair?", choices: ["1", "2", "3", "4"], answer: "2" },
];

export type QuizQuestion = { id: string; prompt: string; choices: string[]; correctChoice: number };
export type QuizRound = {
  stake: number;
  payout: number;
  askedIds: string[];
  question: QuizQuestion;
  phase: "question" | "decision";
};

export function canStartTavernQuiz(player: { x: number; y: number; z: number }, coins: number, stake: number): boolean {
  return Number.isInteger(stake) && stake >= 1 && stake <= TAVERN_QUIZ_MAX_STAKE && coins >= stake
    && Math.abs(player.y - TOWN_TAVERN_QUIZ_TABLE_POSITION.y) <= 1.6
    && Math.hypot(player.x - TOWN_TAVERN_QUIZ_TABLE_POSITION.x, player.z - TOWN_TAVERN_QUIZ_TABLE_POSITION.z) <= 2.6;
}

export function drawQuizQuestion(askedIds: readonly string[], random = Math.random): QuizQuestion | null {
  const available = QUESTIONS.filter(question => !askedIds.includes(question.id));
  if (available.length === 0) return null;
  const question = available[Math.min(available.length - 1, Math.floor(random() * available.length))]!;
  const choices = [...question.choices];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [choices[index], choices[other]] = [choices[other]!, choices[index]!];
  }
  return { id: question.id, prompt: question.prompt, choices, correctChoice: choices.indexOf(question.answer) };
}

export function doubledPayout(payout: number): number {
  return Math.min(TAVERN_QUIZ_MAX_PAYOUT, payout * 2);
}

export function mustSettleQuiz(round: QuizRound): boolean {
  return round.payout >= TAVERN_QUIZ_MAX_PAYOUT || round.askedIds.length >= QUESTIONS.length;
}
