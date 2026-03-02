export enum Suit {
  Spade = "spade",
  Heart = "heart",
  Diamond = "diamond",
  Club = "club",
}

export enum Rank {
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
  Two = 15,
  BlackJoker = 16,
  RedJoker = 17,
}

export interface Card {
  suit: Suit | null; // 大小王的 suit 为 null
  rank: Rank;
}

export enum CardType {
  Single = "single",
  Pair = "pair",
  Triple = "triple",
  TripleWithOne = "tripleWithOne",
  TripleWithPair = "tripleWithPair",
  Straight = "straight",
  DoubleStraight = "doubleStraight",
  TripleStraight = "tripleStraight",
  TripleStraightWithOnes = "tripleStraightWithOnes",
  TripleStraightWithPairs = "tripleStraightWithPairs",
  Bomb = "bomb",
  Rocket = "rocket",
  QuadWithTwo = "quadWithTwo",
  QuadWithTwoPairs = "quadWithTwoPairs",
}

export interface CardPlay {
  type: CardType;
  cards: Card[];
  mainRank: Rank; // 主牌 rank（顺子取最小 rank，飞机取最小三张 rank）
  length?: number; // 顺子/连对/飞机的长度
}
