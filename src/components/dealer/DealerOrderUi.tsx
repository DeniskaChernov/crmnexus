import React from "react";
import { Badge } from "../ui/badge";
import {
  dealerItemStageBadgeClass,
  dealerItemStageLabel,
  type DealerItemStage,
} from "../../lib/dealerOrderStages.ts";

export function DealerStageBadge({ stage }: { stage: string }) {
  const s = stage as DealerItemStage;
  return (
    <Badge className={`${dealerItemStageBadgeClass(s)} border-0 font-normal`}>
      {dealerItemStageLabel(stage)}
    </Badge>
  );
}

export function DealerOrderProgress({ pct }: { pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>Отгрузка</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function DealerStagePipeline({ currentStage }: { currentStage: string }) {
  const stages: DealerItemStage[] = [
    "ordered",
    "crm_processing",
    "in_production",
    "picking",
    "shipped",
    "with_qr",
    "scanned",
  ];
  const currentIdx = stages.indexOf(currentStage as DealerItemStage);

  return (
    <div className="flex flex-wrap gap-1">
      {stages.map((s, i) => {
        const done = currentIdx >= 0 && i <= currentIdx;
        const active = s === currentStage;
        return (
          <div
            key={s}
            className={`text-[10px] px-2 py-1 rounded-full border ${
              active
                ? "bg-emerald-700 text-white border-emerald-700"
                : done
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-neutral-400 border-neutral-200"
            }`}
          >
            {dealerItemStageLabel(s)}
          </div>
        );
      })}
    </div>
  );
}
