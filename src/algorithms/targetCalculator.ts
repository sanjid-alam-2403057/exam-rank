import {
  AssessmentScheme,
  ComponentBreakdown,
  GradeTargetResult,
  SchemeComponent,
  StudentRecord,
  TargetCalculation,
} from '../types';

/**
 * Pure deterministic calculation of marks earned for a single component.
 */
export function calculateComponentEarned(
  component: SchemeComponent,
  marks: Record<string, number | null>
): ComponentBreakdown {
  if (component.type === 'single') {
    const rawVal = marks[component.id];
    const isTaken = rawVal !== null && rawVal !== undefined && !isNaN(rawVal);
    const max = component.maxMarks || component.weight;
    const earnedScaled = isTaken ? (Math.max(0, rawVal) / max) * component.weight : 0;

    return {
      componentId: component.id,
      name: component.name,
      weight: component.weight,
      earnedScaledMarks: Number(earnedScaled.toFixed(2)),
      maxPossibleSoFar: component.weight,
      isCompleted: isTaken,
      notes: isTaken
        ? `${Number(rawVal).toFixed(2)} / ${max.toFixed(2)} (${((rawVal / max) * 100).toFixed(2)}%)`
        : 'Not yet taken',
      takenCount: isTaken ? 1 : 0,
      totalCount: 1,
      subScores: [
        {
          id: component.id,
          name: component.name,
          rawScore: isTaken ? rawVal : null,
          maxScore: max,
          usedInBestN: isTaken,
        },
      ],
    };
  }

  // Best N of M type (e.g., Best 3 of 4 CTs)
  const subComponents = component.subComponents || [];
  const bestN = component.bestN || subComponents.length;

  const subScoreList = subComponents.map((sub) => {
    const raw = marks[sub.id];
    const isTaken = raw !== null && raw !== undefined && !isNaN(raw);
    const pct = isTaken ? raw / sub.maxMarks : -1;
    return {
      id: sub.id,
      name: sub.name,
      rawScore: isTaken ? raw : null,
      maxScore: sub.maxMarks,
      percentage: pct,
      isTaken,
    };
  });

  const takenSubs = subScoreList.filter((s) => s.isTaken);
  const takenCount = takenSubs.length;

  if (takenCount === 0) {
    return {
      componentId: component.id,
      name: component.name,
      weight: component.weight,
      earnedScaledMarks: 0,
      maxPossibleSoFar: component.weight,
      isCompleted: false,
      notes: `0 of ${subComponents.length} taken`,
      takenCount: 0,
      totalCount: subComponents.length,
      subScores: subScoreList.map((s) => ({
        id: s.id,
        name: s.name,
        rawScore: null,
        maxScore: s.maxScore,
        usedInBestN: false,
      })),
    };
  }

  // Sort taken by percentage descending
  const sortedTaken = [...takenSubs].sort((a, b) => b.percentage - a.percentage);

  // Take up to bestN (or available if fewer than bestN)
  const numToTake = Math.min(bestN, takenCount);
  const usedItems = sortedTaken.slice(0, numToTake);
  const usedIds = new Set(usedItems.map((u) => u.id));

  // Average percentage of used items
  const avgPct =
    usedItems.reduce((acc, curr) => acc + curr.percentage, 0) / numToTake;
  const earnedScaled = avgPct * component.weight;

  let note = '';
  if (takenCount < bestN) {
    note = `${takenCount} of ${bestN} taken so far, using available ${takenCount}`;
  } else {
    const names = usedItems.map((u) => u.name).join(', ');
    note = `Best ${numToTake} of ${takenCount}: ${names}`;
  }

  return {
    componentId: component.id,
    name: component.name,
    weight: component.weight,
    earnedScaledMarks: Number(earnedScaled.toFixed(2)),
    maxPossibleSoFar: component.weight,
    isCompleted: takenCount === subComponents.length,
    notes: note,
    takenCount,
    totalCount: subComponents.length,
    subScores: subScoreList.map((s) => ({
      id: s.id,
      name: s.name,
      rawScore: s.rawScore,
      maxScore: s.maxScore,
      usedInBestN: usedIds.has(s.id),
    })),
  };
}

/**
 * Calculates Best Case and Worst Case Sessional totals given untaken components.
 */
export function calculateSessionalBounds(
  scheme: AssessmentScheme,
  currentMarks: Record<string, number | null>
): { bestCase: number; worstCase: number } {
  const nonFinals = scheme.components.filter((c) => !c.isFinalExam);

  let bestTotal = 0;
  let worstTotal = 0;

  for (const comp of nonFinals) {
    if (comp.type === 'single') {
      const val = currentMarks[comp.id];
      const isTaken = val !== null && val !== undefined && !isNaN(val);
      const max = comp.maxMarks || comp.weight;
      if (isTaken) {
        const earned = (Math.max(0, val) / max) * comp.weight;
        bestTotal += earned;
        worstTotal += earned;
      } else {
        bestTotal += comp.weight;
        worstTotal += 0;
      }
    } else {
      const subs = comp.subComponents || [];
      const bestN = comp.bestN || subs.length;

      const bestScores = subs.map((sub) => {
        const val = currentMarks[sub.id];
        return val !== null && val !== undefined && !isNaN(val)
          ? val / sub.maxMarks
          : 1.0;
      });
      bestScores.sort((a, b) => b - a);
      const bestAvg =
        bestScores.slice(0, bestN).reduce((a, b) => a + b, 0) / bestN;
      bestTotal += bestAvg * comp.weight;

      const worstScores = subs.map((sub) => {
        const val = currentMarks[sub.id];
        return val !== null && val !== undefined && !isNaN(val)
          ? val / sub.maxMarks
          : 0.0;
      });
      worstScores.sort((a, b) => b - a);
      const worstAvg =
        worstScores.slice(0, bestN).reduce((a, b) => a + b, 0) / bestN;
      worstTotal += worstAvg * comp.weight;
    }
  }

  return {
    bestCase: Number(bestTotal.toFixed(2)),
    worstCase: Number(worstTotal.toFixed(2)),
  };
}

/**
 * Determine difficulty level and styling categorizations
 */
function getDifficultyLevel(
  needed: number,
  finalWeight: number
): 'secured' | 'easy' | 'moderate' | 'challenging' | 'critical' | 'unreachable' {
  if (needed <= 0) return 'secured';
  if (needed > finalWeight) return 'unreachable';
  const pct = (needed / finalWeight) * 100;
  if (pct <= 50) return 'easy';
  if (pct <= 75) return 'moderate';
  if (pct <= 90) return 'challenging';
  return 'critical';
}

/**
 * Checks whether required sessional marks (at least 3 CTs, Assignment, Attendance) are present.
 * If any of these are absent/missing, the final target needed must remain blank.
 */
function checkTargetPrerequisites(
  scheme: AssessmentScheme,
  activeMarks: Record<string, number | null>,
  componentsBreakdown: ComponentBreakdown[]
): { met: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const nonFinals = scheme.components.filter((c) => !c.isFinalExam);

  for (const comp of nonFinals) {
    if (comp.type === 'best_n_of_m') {
      const subs = comp.subComponents || [];
      const requiredCts = Math.min(3, subs.length);
      const breakdown = componentsBreakdown.find((b) => b.componentId === comp.id);
      const taken = breakdown?.takenCount ?? 0;
      if (taken < requiredCts) {
        reasons.push(`Need at least ${requiredCts} CTs (${taken} present)`);
      }
    } else if (comp.type === 'single') {
      const idLower = comp.id.toLowerCase();
      const nameLower = comp.name.toLowerCase();
      const isAttendance = idLower.includes('attendance') || nameLower.includes('attendance');
      const isAssignment = idLower.includes('assignment') || nameLower.includes('assignment');

      if (isAttendance || isAssignment) {
        const val = activeMarks[comp.id];
        const present = val !== null && val !== undefined && !isNaN(val);
        if (!present) {
          reasons.push(`${comp.name} mark missing`);
        }
      }
    }
  }

  return {
    met: reasons.length === 0,
    reasons,
  };
}

/**
 * Main Target Calculation for a student given an AssessmentScheme
 */
export function calculateStudentTarget(
  student: StudentRecord,
  scheme: AssessmentScheme,
  whatIfOverrides?: Record<string, number | null>
): TargetCalculation {
  const activeMarks = { ...student.marks, ...(whatIfOverrides || {}) };

  const finalComp = scheme.components.find((c) => c.isFinalExam);
  const finalWeight = finalComp ? finalComp.weight : 60;
  const nonFinals = scheme.components.filter((c) => !c.isFinalExam);
  const sessionalWeightTotal = nonFinals.reduce((acc, c) => acc + c.weight, 0);

  const componentsBreakdown: ComponentBreakdown[] = nonFinals.map((comp) =>
    calculateComponentEarned(comp, activeMarks)
  );

  const sessionalTotalEarned = Number(
    componentsBreakdown
      .reduce((acc, c) => acc + c.earnedScaledMarks, 0)
      .toFixed(2)
  );

  const { bestCase: bestCaseSessional, worstCase: worstCaseSessional } =
    calculateSessionalBounds(scheme, activeMarks);

  const targetTotalMarks = scheme.targetGradeThreshold;
  const targetGradeName = scheme.targetGradeName || 'A+';

  const prereq = checkTargetPrerequisites(scheme, activeMarks, componentsBreakdown);
  const rawNeeded = targetTotalMarks - sessionalTotalEarned;

  let neededInFinal: number | null;
  let neededPercentage: number | null;
  let verdict: TargetCalculation['verdict'];
  let verdictMessage: string;
  let difficulty: TargetCalculation['difficulty'];

  if (!prereq.met) {
    neededInFinal = null;
    neededPercentage = null;
    verdict = 'incomplete';
    difficulty = 'incomplete';
    verdictMessage = `Waiting on: ${prereq.reasons.join(', ')}.`;
  } else if (sessionalTotalEarned >= targetTotalMarks) {
    neededInFinal = 0;
    neededPercentage = 0;
    verdict = 'secured';
    difficulty = 'secured';
    verdictMessage = `Secured (${sessionalTotalEarned.toFixed(2)} >= ${targetTotalMarks.toFixed(2)}).`;
  } else if (rawNeeded <= finalWeight) {
    neededInFinal = Number(Math.min(finalWeight, Math.max(0, rawNeeded)).toFixed(2));
    neededPercentage = Number(((neededInFinal / finalWeight) * 100).toFixed(2));
    verdict = 'reachable';
    difficulty = getDifficultyLevel(rawNeeded, finalWeight);
    verdictMessage = `Needs ${neededInFinal.toFixed(2)} / ${finalWeight.toFixed(2)} (${neededPercentage.toFixed(2)}%) for ${targetGradeName}.`;
  } else {
    // Never exceed finalWeight (60)
    neededInFinal = Number(finalWeight.toFixed(2));
    neededPercentage = 100;
    verdict = 'unreachable';
    difficulty = 'unreachable';
    const maxPossible = sessionalTotalEarned + finalWeight;
    verdictMessage = `Unreachable (max possible ${maxPossible.toFixed(2)} < ${targetTotalMarks.toFixed(2)}).`;
  }

  const bestCaseFinalNeeded = Number(
    Math.min(finalWeight, Math.max(0, targetTotalMarks - bestCaseSessional)).toFixed(2)
  );
  const worstCaseFinalNeeded = Number(
    Math.min(finalWeight, Math.max(0, targetTotalMarks - worstCaseSessional)).toFixed(2)
  );

  const allGradeTargets: GradeTargetResult[] = (scheme.gradeThresholds || []).map(
    (threshold) => {
      if (!prereq.met) {
        return {
          grade: threshold.grade,
          minMarks: threshold.minMarks,
          neededInFinal: null,
          finalPercentage: null,
          isReachable: false,
          isAlreadySecured: false,
          difficulty: 'incomplete',
        };
      }

      const delta = threshold.minMarks - sessionalTotalEarned;
      const clampedNeeded = Number(Math.min(finalWeight, Math.max(0, delta)).toFixed(2));
      const pct = Number(((clampedNeeded / finalWeight) * 100).toFixed(2));
      const isSecured = sessionalTotalEarned >= threshold.minMarks;
      const isReachable = delta <= finalWeight;

      return {
        grade: threshold.grade,
        minMarks: threshold.minMarks,
        neededInFinal: clampedNeeded,
        finalPercentage: pct,
        isReachable,
        isAlreadySecured: isSecured,
        difficulty: getDifficultyLevel(delta, finalWeight),
      };
    }
  );

  const hasPendingComponents = componentsBreakdown.some((c) => !c.isCompleted);

  return {
    student,
    sessionalTotalEarned,
    sessionalWeightTotal,
    finalWeight,
    targetTotalMarks,
    targetGradeName,
    isTargetPrerequisitesMet: prereq.met,
    missingPrerequisiteReasons: prereq.reasons,
    neededInFinal,
    neededPercentage,
    verdict,
    verdictMessage,
    difficulty,
    bestCaseSessional,
    worstCaseSessional,
    bestCaseFinalNeeded,
    worstCaseFinalNeeded,
    componentsBreakdown,
    allGradeTargets,
    hasPendingComponents,
  };
}
