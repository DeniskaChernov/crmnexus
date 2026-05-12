import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Порционная отрисовка длинных списков: при приближении к нижнему sentinel подгружается следующая порция.
 * @param resetKey — при изменении счётчик видимых строк сбрасывается (поиск, сортировка, вкладка).
 */
export function useChunkedList<T>(items: T[], resetKey: string, batchSize = 32) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  useEffect(() => {
    if (visibleCount >= items.length) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
        }
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, visibleCount, batchSize]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  return { visibleItems, sentinelRef, hasMore, visibleCount, total: items.length };
}
