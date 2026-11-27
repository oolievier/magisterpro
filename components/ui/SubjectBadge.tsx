"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/app/providers";

/**
 * Klikbaar vaklabel: opent de cijferstudio met alle details van dat vak
 * (cijfers, docent, gemiddelde, PTA en grafieken).
 */
export function SubjectBadge({
  subjectId,
  label,
  showDot = true,
  className = "",
}: {
  subjectId: string;
  label?: string;
  showDot?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { data } = useApp();
  const subject = data.subjects.find((s) => s.id === subjectId);
  const text = label ?? subject?.name ?? "Onbekend vak";
  if (!subjectId) return <span className={className}>{text}</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/grades?subject=${encodeURIComponent(subjectId)}`);
      }}
      title={`Bekijk alle gegevens van ${subject?.name ?? text}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition hover:text-accent hover:underline ${className}`}
    >
      {showDot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color ?? "#64748b" }} />}
      <span className="truncate">{text}</span>
    </button>
  );
}
