"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { VariableSizeList } from "react-window";
import type { Item } from "@/lib/types";

export type VirtualData = {
  items: Item[];
  renderItem: (i: Item) => React.ReactNode;
  sizes: React.MutableRefObject<Map<string, number>>;
  listRef: React.RefObject<VariableSizeList | null>;
  gap: number;
};

export const Row = React.memo(function Row({ index, style, data }: { index: number; style: React.CSSProperties; data: VirtualData }) {
  const ref = useRef<HTMLDivElement>(null);
  const { items, renderItem, sizes, listRef, gap } = data;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    const id = items[index].id;
    if (sizes.current.get(id) !== h) {
      sizes.current.set(id, h);
      listRef.current?.resetAfterIndex(index);
    }
  });
  return (
    <div style={style}>
      <div ref={ref} style={{ paddingBottom: gap }}>
        {renderItem(items[index])}
      </div>
    </div>
  );
});

export function VirtualList({
  items,
  renderItem,
  estimate,
  gap
}: {
  items: Item[];
  renderItem: (i: Item) => React.ReactNode;
  estimate: number;
  gap: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);
  const sizes = useRef<Map<string, number>>(new Map());
  const [height, setHeight] = useState(560);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [items]);

  const itemSize = useCallback((i: number) => sizes.current.get(items[i].id) ?? estimate, [items, estimate]);
  const data: VirtualData = { items, renderItem, sizes, listRef, gap };

  return (
    <div ref={wrapRef} className="list-scroll mt-6 max-h-[72vh] overflow-y-auto pr-1">
      <VariableSizeList
        height={height}
        width="100%"
        itemCount={items.length}
        itemSize={itemSize}
        itemData={data}
        overscanCount={6}
        ref={listRef}
      >
        {Row}
      </VariableSizeList>
    </div>
  );
}

