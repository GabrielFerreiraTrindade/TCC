import { getPlayerLevel } from "@studyquest/shared";

export function PlayerLevelBadge({ totalPoints }: { totalPoints: number }) {
  const { level, pointsIntoLevel, pointsForNextLevel, progress } = getPlayerLevel(totalPoints);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Nível {level}</span>
        <span>
          {pointsIntoLevel} / {pointsForNextLevel} pts
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
