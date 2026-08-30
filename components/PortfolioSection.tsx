"use client";

import { PlaceholderFrame } from "@/components/PlaceholderFrame";
import { Reveal } from "@/components/Reveal";
import { getEmbedUrl } from "@/lib/video-embed";

export type PortfolioItemView = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  videoUrl: string | null;
  featured: boolean;
};

function ProjectCard({ item }: { item: PortfolioItemView }) {
  const embedUrl = getEmbedUrl(item.videoUrl);

  return (
    <div className={item.featured ? "sm:col-span-2" : ""}>
      <PlaceholderFrame
        className={
          "transition-transform duration-500 " +
          (item.featured ? "aspect-[16/8] hover:scale-[1.01]" : "aspect-video hover:scale-[1.02]")
        }
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute bottom-6 left-6">
            <div className="font-mono text-xs tracking-widest text-muted uppercase">
              {item.category ?? "Proyecto"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">
              {item.title}
            </div>
          </div>
        )}
      </PlaceholderFrame>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <span className="font-mono text-[11px] tracking-widest text-accent uppercase">
            {item.category ?? "Proyecto"}
          </span>
          <h3 className="mt-1 font-display text-lg font-bold uppercase sm:text-xl">
            {item.title}
          </h3>
        </div>
        {item.description && (
          <p className="max-w-md font-mono text-sm text-muted">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function PortfolioSection({ items }: { items: PortfolioItemView[] }) {
  if (items.length === 0) {
    return (
      <Reveal delay={0.1}>
        <PlaceholderFrame className="mt-8 flex aspect-[16/8] items-center justify-center">
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Próximamente
          </span>
        </PlaceholderFrame>
      </Reveal>
    );
  }

  return (
    <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2">
      {items.map((item, i) => (
        <Reveal key={item.id} delay={i * 0.06} className={item.featured ? "sm:col-span-2" : ""}>
          <ProjectCard item={item} />
        </Reveal>
      ))}
    </div>
  );
}
