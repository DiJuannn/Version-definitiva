type MarqueeProps = {
  items: string[];
  className?: string;
};

export function Marquee({ items, className }: MarqueeProps) {
  const track = (
    <div className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-6">
          <span className="font-mono text-sm tracking-widest whitespace-nowrap uppercase">
            {item}
          </span>
          <span className="text-accent">●</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={`flex w-full overflow-hidden ${className ?? ""}`}>
      <div className="flex w-max animate-[marquee_28s_linear_infinite]">
        {track}
        {track}
      </div>
    </div>
  );
}
