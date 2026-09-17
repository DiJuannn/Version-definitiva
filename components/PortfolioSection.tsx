"use client";

import Link from "next/link";
import { PlaceholderFrame } from "@/components/PlaceholderFrame";
import { MediaFrame } from "@/components/MediaFrame";
import { Reveal } from "@/components/Reveal";
import { getEmbedUrl } from "@/lib/video-embed";

export type PortfolioItemView = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  videoUrl: string | null;
  featured: boolean;
  slug?: string | null;
  year?: number | null;
  heroImageUrl?: string | null;
};

function ProjectCard({ item, reversed }: { item: PortfolioItemView; reversed: boolean }) {
  const embedUrl = getEmbedUrl(item.videoUrl);

  const media = embedUrl ? (
    <PlaceholderFrame className="aspect-video transition-transform duration-500 group-hover:scale-[1.01]">
      <iframe
        src={embedUrl}
        title={item.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </PlaceholderFrame>
  ) : (
    <MediaFrame
      src={item.heroImageUrl}
      alt={item.title}
      label={`${item.title} — fotograma`}
      className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.01] sm:aspect-video"
    />
  );

  const content = (
    <div
      className={`flex flex-col gap-6 sm:items-end sm:gap-10 ${
        reversed ? "sm:flex-row-reverse" : "sm:flex-row"
      }`}
    >
      <div className="sm:w-[68%]">{media}</div>
      <div className={`sm:w-[32%] ${reversed ? "sm:text-left" : "sm:text-right"}`}>
        <span className="font-mono text-[11px] tracking-widest text-accent-purple-soft uppercase">
          {[item.category, item.year].filter(Boolean).join(" · ") || "Proyecto"}
        </span>
        <h3 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-2 font-mono text-sm text-muted">{item.description}</p>
        )}
      </div>
    </div>
  );

  if (!item.slug) {
    return <div className="group">{content}</div>;
  }

  return (
    <Link href={`/proyectos/${item.slug}`} className="group block">
      {content}
    </Link>
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
    <div className="mt-8 flex flex-col gap-16 sm:gap-24">
      {items.map((item, i) => (
        <Reveal key={item.id} delay={i * 0.08}>
          <ProjectCard item={item} reversed={i % 2 === 1} />
        </Reveal>
      ))}
    </div>
  );
}
