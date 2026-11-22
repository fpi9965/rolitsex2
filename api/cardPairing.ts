import { masterStages, type Gender } from "@contracts/cards";

/**
 * يختار مصدراً مستقلاً لبطاقة الطرف الآخر. الاختيار ثابت طوال عرض البطاقة،
 * لأن رقم البطاقة الأساسية ومجموعة السحب والمستخدم لا تتغير حتى الإتمام أو التخطي.
 */
export function choosePartnerCardIndex(
  stage: number,
  primaryIndex: number,
  pool: number[],
  used: number[],
  turnGender: Gender,
  partnerGender: Gender,
): number | null {
  const cards = masterStages[stage];
  const primaryCard = cards?.[primaryIndex];
  if (!cards || !primaryCard) return null;

  const primaryText = primaryCard[turnGender];
  const isIndependent = (index: number) => {
    const candidate = cards[index];
    return index !== primaryIndex && Boolean(candidate) && candidate[partnerGender] !== primaryText;
  };
  const unused = pool.filter((index) => !used.includes(index) && isIndependent(index));
  const fallback = cards.map((_, index) => index).filter(isIndependent);
  const unusedFallback = fallback.filter((index) => !used.includes(index));
  const candidates = unused.length ? unused : unusedFallback.length ? unusedFallback : fallback;

  if (!candidates.length) return null;
  return candidates[primaryIndex % candidates.length];
}
