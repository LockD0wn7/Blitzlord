/**
 * 计算最终得分。基础分固定为 1，已隐含在公式中。
 *
 * 公式：基础分(1) × baseBid × 2^bombCount × (rocketUsed ? 2 : 1) × (isSpring ? 2 : 1)
 */
export function calculateScore(params: {
  baseBid: 1 | 2 | 3;
  bombCount: number;
  rocketUsed: boolean;
  isSpring: boolean;
}): number {
  const { baseBid, bombCount, rocketUsed, isSpring } = params;
  return (
    baseBid *
    Math.pow(2, bombCount) *
    (rocketUsed ? 2 : 1) *
    (isSpring ? 2 : 1)
  );
}

/**
 * 判断是否春天。
 *
 * - 地主春天：仅当地主赢时，两个农民 playCount 都为 0（地主出完牌，农民一张未出）
 * - 反春天：仅当农民赢时，地主只出过 1 手牌（第一手），农民先出完
 *
 * @param winnerRole - 赢家的角色，用于区分春天和反春天
 */
export function isSpring(
  landlordPlayCount: number,
  peasantsPlayCount: [number, number],
  winnerRole: "landlord" | "peasant",
): boolean {
  // 地主春天：地主赢且两个农民都没出过牌
  if (winnerRole === "landlord" && peasantsPlayCount[0] === 0 && peasantsPlayCount[1] === 0) {
    return true;
  }
  // 反春天：农民赢且地主只出过 1 手牌
  if (winnerRole === "peasant" && landlordPlayCount === 1) {
    return true;
  }
  return false;
}
