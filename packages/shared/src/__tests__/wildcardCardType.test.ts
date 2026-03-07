import { describe, expect, it } from "vitest";
import { identifyCardType } from "../rules/cardType.js";
import { CardType, Rank, Suit } from "../types/card.js";
import type { Card } from "../types/card.js";

/** Helper to create a card */
function c(rank: Rank, suit: Suit | null = Suit.Spade): Card {
  return { rank, suit };
}

describe("identifyCardType with wildcard (赖子)", () => {
  // Use Rank.Seven as wildcard in most tests
  const W = Rank.Seven;

  // ─────────────────────────────────────────────
  // 1. Backward compatibility
  // ─────────────────────────────────────────────
  describe("backward compatibility", () => {
    it("no wildcardRank → same behavior as before", () => {
      const result = identifyCardType([c(Rank.Ace)]);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Single);
    });

    it("wildcardRank=null → same behavior", () => {
      const result = identifyCardType([c(Rank.Ace)], null);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Single);
    });

    it("wildcardRank=undefined → same behavior", () => {
      const result = identifyCardType([c(Rank.Ace)], undefined);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Single);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Wild card as single (retaining natural identity)
  // ─────────────────────────────────────────────
  describe("wild card as single", () => {
    it("single wild card → Single of wildcardRank", () => {
      const result = identifyCardType([c(W)], W);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Single);
      expect(result!.mainRank).toBe(W);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Wild card retaining original identity (pair of wildcardRank)
  // ─────────────────────────────────────────────
  describe("wild cards retaining natural identity", () => {
    it("two wild cards → Pair of wildcardRank", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(W, Suit.Heart)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Pair);
      expect(result!.mainRank).toBe(W);
    });

    it("three wild cards → Triple of wildcardRank", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(W, Suit.Heart), c(W, Suit.Diamond)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Triple);
      expect(result!.mainRank).toBe(W);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Wild + natural forming pairs, triples
  // ─────────────────────────────────────────────
  describe("wild + natural forming pairs and triples", () => {
    it("1 wild + 1 natural (Ace) → Pair of Ace", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(Rank.Ace, Suit.Heart)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Pair);
      // Could be pair of 7 or pair of Ace; either valid, but Ace is higher priority
      // The implementation should pick a valid interpretation
    });

    it("2 wilds + 1 natural (King) → Triple of King", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(W, Suit.Heart), c(Rank.King, Suit.Diamond)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Triple);
    });

    it("1 wild + 2 naturals (same rank) → Triple", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(Rank.Five, Suit.Heart), c(Rank.Five, Suit.Diamond)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Triple);
      expect(result!.mainRank).toBe(Rank.Five);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Bomb variants
  // ─────────────────────────────────────────────
  describe("bomb variants", () => {
    it("hard bomb (4 natural, no wilds) → normal Bomb", () => {
      const result = identifyCardType(
        [
          c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart),
          c(Rank.Nine, Suit.Diamond), c(Rank.Nine, Suit.Club),
        ],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.mainRank).toBe(Rank.Nine);
      expect(result!.softBomb).toBeFalsy();
      expect(result!.pureWild).toBeFalsy();
    });

    it("pure wild bomb (4 wild cards) → Bomb with pureWild", () => {
      const result = identifyCardType(
        [
          c(W, Suit.Spade), c(W, Suit.Heart),
          c(W, Suit.Diamond), c(W, Suit.Club),
        ],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.pureWild).toBe(true);
      expect(result!.mainRank).toBe(W);
    });

    it("soft bomb: 1 wild + 3 natural same rank → Bomb with softBomb", () => {
      const result = identifyCardType(
        [
          c(W, Suit.Spade),
          c(Rank.King, Suit.Heart), c(Rank.King, Suit.Diamond), c(Rank.King, Suit.Club),
        ],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.softBomb).toBe(true);
      expect(result!.mainRank).toBe(Rank.King);
    });

    it("soft bomb: 2 wilds + 2 natural same rank → Bomb with softBomb", () => {
      const result = identifyCardType(
        [
          c(W, Suit.Spade), c(W, Suit.Heart),
          c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
        ],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.softBomb).toBe(true);
      expect(result!.mainRank).toBe(Rank.Ace);
    });

    it("soft bomb: 3 wilds + 1 natural → Bomb with softBomb", () => {
      const result = identifyCardType(
        [
          c(W, Suit.Spade), c(W, Suit.Heart), c(W, Suit.Diamond),
          c(Rank.Three, Suit.Club),
        ],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.softBomb).toBe(true);
      expect(result!.mainRank).toBe(Rank.Three);
    });
  });

  // ─────────────────────────────────────────────
  // 6. Rocket unchanged
  // ─────────────────────────────────────────────
  describe("rocket", () => {
    it("rocket is unchanged (actual jokers required)", () => {
      const result = identifyCardType(
        [c(Rank.BlackJoker, null), c(Rank.RedJoker, null)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Rocket);
    });

    it("wild card cannot substitute for joker in rocket", () => {
      const result = identifyCardType(
        [c(W, Suit.Spade), c(Rank.RedJoker, null)],
        W,
      );
      // This is just a pair (wild + RedJoker), but RedJoker can't pair
      // So it could be pair of 7 (wild as natural) + RedJoker → invalid 2-card combo
      // Or wild substitutes for BlackJoker → but wilds CANNOT substitute jokers
      // So it should be null (two different ranks, not a rocket)
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 7. Straights with wilds
  // ─────────────────────────────────────────────
  describe("straights with wilds", () => {
    it("straight with 1 wild filling a gap: 3 4 [W→5] 6 7(natural) → but 7 is wild...", () => {
      // Use Rank.Four as wildcard to avoid confusion
      const W2 = Rank.Four;
      // Cards: 3, W(4), 5, 6, 7 → wild 4 fills as 4 naturally → straight 3-7
      const result = identifyCardType(
        [c(Rank.Three), c(W2, Suit.Heart), c(Rank.Five), c(Rank.Six), c(Rank.Seven)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Three);
      expect(result!.length).toBe(5);
    });

    it("straight with wild filling a gap in the middle", () => {
      // wildcardRank = 9, cards: 3 4 5 [W→6] 7 → straight 3-7
      const W2 = Rank.Nine;
      const result = identifyCardType(
        [c(Rank.Three), c(Rank.Four), c(Rank.Five), c(W2), c(Rank.Seven)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Three);
      expect(result!.length).toBe(5);
    });

    it("straight including Rank.Two in wildcard mode", () => {
      // wildcardRank = 5, cards: J Q K A 2 → straight J-2 (5 cards)
      const W2 = Rank.Five;
      const result = identifyCardType(
        [c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.Ace), c(Rank.Two)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Jack);
      expect(result!.length).toBe(5);
    });

    it("straight with wild filling gap to include Rank.Two", () => {
      // wildcardRank = 5, cards: Q K [W→A] A 2 → but that's 2 Aces...
      // Better: Q K A [W→missing slot to make it work]
      // wildcardRank = 6, cards: J Q K [W→A] 2 → straight J-2
      const W2 = Rank.Six;
      const result = identifyCardType(
        [c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(W2), c(Rank.Two)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Jack);
      expect(result!.length).toBe(5);
    });

    it("straight with 2 wilds filling 2 gaps", () => {
      // wildcardRank = 8, cards: 3 [W→4] [W→5] 6 7 → straight 3-7
      const W2 = Rank.Eight;
      const result = identifyCardType(
        [c(Rank.Three), c(W2, Suit.Spade), c(W2, Suit.Heart), c(Rank.Six), c(Rank.Seven)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Three);
      expect(result!.length).toBe(5);
    });

    it("Rank.Two in straight is invalid without wildcardRank", () => {
      const result = identifyCardType(
        [c(Rank.Ten), c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.Ace), c(Rank.Two)],
      );
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 8. Double straights with wilds
  // ─────────────────────────────────────────────
  describe("double straights with wilds", () => {
    it("double straight with 1 wild filling a gap", () => {
      // wildcardRank = 9, cards: 55 66 [W+7→77] → double straight 5-7
      const W2 = Rank.Nine;
      const result = identifyCardType(
        [
          c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
          c(Rank.Six, Suit.Spade), c(Rank.Six, Suit.Heart),
          c(W2, Suit.Spade), c(Rank.Seven, Suit.Heart),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.DoubleStraight);
      expect(result!.mainRank).toBe(Rank.Five);
      expect(result!.length).toBe(3);
    });

    it("double straight with 2 wilds filling a whole pair gap", () => {
      // wildcardRank = 9, cards: 33 [WW→44] 55 → double straight 3-5
      const W2 = Rank.Nine;
      const result = identifyCardType(
        [
          c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
          c(W2, Suit.Spade), c(W2, Suit.Heart),
          c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.DoubleStraight);
      expect(result!.mainRank).toBe(Rank.Three);
      expect(result!.length).toBe(3);
    });
  });

  // ─────────────────────────────────────────────
  // 9. Airplanes with wilds
  // ─────────────────────────────────────────────
  describe("airplanes (triple straight) with wilds", () => {
    it("triple straight with 1 wild filling a gap in one triple", () => {
      // wildcardRank = 3, cards: 88[W→8] 999 → triple straight 8-9
      const W2 = Rank.Three;
      const result = identifyCardType(
        [
          c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(W2, Suit.Diamond),
          c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.TripleStraight);
      expect(result!.mainRank).toBe(Rank.Eight);
      expect(result!.length).toBe(2);
    });

    it("airplane with wilds and kickers (带单)", () => {
      // wildcardRank = 3, cards: 88[W→8] 999 + 5 6 → airplane带单
      const W2 = Rank.Three;
      const result = identifyCardType(
        [
          c(Rank.Eight, Suit.Spade), c(Rank.Eight, Suit.Heart), c(W2, Suit.Spade),
          c(Rank.Nine, Suit.Spade), c(Rank.Nine, Suit.Heart), c(Rank.Nine, Suit.Diamond),
          c(Rank.Five), c(Rank.Six),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.TripleStraightWithOnes);
      expect(result!.mainRank).toBe(Rank.Eight);
      expect(result!.length).toBe(2);
    });
  });

  // ─────────────────────────────────────────────
  // 10. Triple + kicker with wilds
  // ─────────────────────────────────────────────
  describe("triple + kicker with wilds", () => {
    it("triple with one: 2 wilds + 1 natural triple + 1 kicker", () => {
      // wildcardRank = 8, cards: [W W K] + 3 → triple K with one
      const W2 = Rank.Eight;
      const result = identifyCardType(
        [c(W2, Suit.Spade), c(W2, Suit.Heart), c(Rank.King, Suit.Diamond), c(Rank.Three)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.TripleWithOne);
    });

    it("triple with pair: 1 wild + 2 natural forming triple + pair kicker", () => {
      // wildcardRank = 8, cards: [W K K] + 33 → triple K with pair 3
      const W2 = Rank.Eight;
      const result = identifyCardType(
        [
          c(W2, Suit.Spade), c(Rank.King, Suit.Heart), c(Rank.King, Suit.Diamond),
          c(Rank.Three, Suit.Spade), c(Rank.Three, Suit.Heart),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.TripleWithPair);
      expect(result!.mainRank).toBe(Rank.King);
    });
  });

  // ─────────────────────────────────────────────
  // 11. Quad + kicker with wilds
  // ─────────────────────────────────────────────
  describe("quad + kicker with wilds (soft bomb + kickers)", () => {
    it("quad with two: 1 wild + 3 natural forming bomb + 2 kickers", () => {
      // wildcardRank = 3, cards: [W A A A] + 5 6 → quad A with two
      const W2 = Rank.Three;
      const result = identifyCardType(
        [
          c(W2, Suit.Spade),
          c(Rank.Ace, Suit.Heart), c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
          c(Rank.Five), c(Rank.Six),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.QuadWithTwo);
      expect(result!.mainRank).toBe(Rank.Ace);
    });

    it("quad with two pairs: 1 wild + 3 natural forming bomb + 2 pairs kicker", () => {
      // wildcardRank = 3, cards: [W A A A] + 55 66 → quad A with two pairs
      const W2 = Rank.Three;
      const result = identifyCardType(
        [
          c(W2, Suit.Spade),
          c(Rank.Ace, Suit.Heart), c(Rank.Ace, Suit.Diamond), c(Rank.Ace, Suit.Club),
          c(Rank.Five, Suit.Spade), c(Rank.Five, Suit.Heart),
          c(Rank.Six, Suit.Spade), c(Rank.Six, Suit.Heart),
        ],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.QuadWithTwoPairs);
      expect(result!.mainRank).toBe(Rank.Ace);
    });
  });

  // ─────────────────────────────────────────────
  // 12. Edge cases
  // ─────────────────────────────────────────────
  describe("edge cases", () => {
    it("wild cards cannot substitute for jokers", () => {
      // 1 wild + BlackJoker → cannot form rocket
      const result = identifyCardType(
        [c(W, Suit.Spade), c(Rank.BlackJoker, null)],
        W,
      );
      // This should be null since wild can't substitute RedJoker
      expect(result).toBeNull();
    });

    it("all 4 wilds should be pure wild bomb, not be quad+kicker with extra cards", () => {
      // 4 wilds only → pure wild bomb
      const result = identifyCardType(
        [c(W, Suit.Spade), c(W, Suit.Heart), c(W, Suit.Diamond), c(W, Suit.Club)],
        W,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Bomb);
      expect(result!.pureWild).toBe(true);
    });

    it("wildcardRank = Two, two 2s form a valid pair", () => {
      const result = identifyCardType(
        [c(Rank.Two, Suit.Spade), c(Rank.Two, Suit.Heart)],
        Rank.Two,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Pair);
      expect(result!.mainRank).toBe(Rank.Two);
    });

    it("long straight with Rank.Two in wildcard mode: 10 J Q K A 2", () => {
      const W2 = Rank.Three;
      const result = identifyCardType(
        [c(Rank.Ten), c(Rank.Jack), c(Rank.Queen), c(Rank.King), c(Rank.Ace), c(Rank.Two)],
        W2,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(CardType.Straight);
      expect(result!.mainRank).toBe(Rank.Ten);
      expect(result!.length).toBe(6);
    });
  });
});
