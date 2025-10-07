import React, { useRef, useState, useEffect } from 'react';

interface Item { _id: string; status: string; fare?: number; createdAt: string }
interface Props { items: Item[]; rowHeight?: number; overscan?: number; render: (item: Item) => React.ReactNode; height: number; }

export const VirtualizedRideList: React.FC<Props> = ({ items, rowHeight=64, overscan=4, render, height }) => {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const visible = items.slice(start, end);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    function onScroll() { if (el) setScrollTop(el.scrollTop); }
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={containerRef} style={{height, overflowY:'auto', position:'relative', border:'1px solid #ddd', borderRadius:4}}>
      <div style={{height: totalHeight, position:'relative'}}>
        {visible.map((it, i) => {
          const idx = start + i;
            return (
              <div key={it._id} style={{position:'absolute', top: idx*rowHeight, left:0, right:0, height:rowHeight-4, padding:8}}>
                {render(it)}
              </div>
            );
        })}
      </div>
    </div>
  );
};
