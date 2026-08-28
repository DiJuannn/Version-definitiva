import Image from "next/image";
import {
  AJOLOTE_IMAGE_HEIGHT,
  AJOLOTE_IMAGE_SRC,
  AJOLOTE_IMAGE_WIDTH,
} from "@/lib/ajolote-image";

type AjoloteLogoProps = {
  className?: string;
  priority?: boolean;
};

export function AjoloteLogo({ className, priority }: AjoloteLogoProps) {
  return (
    <Image
      src={AJOLOTE_IMAGE_SRC}
      alt="Versión definitiva"
      width={AJOLOTE_IMAGE_WIDTH}
      height={AJOLOTE_IMAGE_HEIGHT}
      priority={priority}
      className={className}
    />
  );
}
