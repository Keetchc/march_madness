"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useState } from "react";

/** Stored URLs from Dynamo / OAuth are sometimes http, protocol-relative, or trimmed oddly. */
function normalizePictureUrl(src: string): string {
  let t = src.trim();
  if (!t) return "";
  if (t.startsWith("//")) t = `https:${t}`;
  if (t.startsWith("http://") && /googleusercontent\.com/i.test(t)) {
    t = `https://${t.slice(7)}`;
  }
  return t;
}

function isSafeImageSrc(src: string): boolean {
  const t = src.trim();
  if (t.startsWith("/")) return true;
  return t.startsWith("https://") || t.startsWith("http://");
}

/**
 * Profile photo with graceful fallback. Uses a plain &lt;img&gt; (not next/image) so avatars
 * work inside &lt;Link&gt; rows (group standings) and avoid optimizer / remotePatterns edge cases.
 * Google CDNs sometimes behave better with referrerPolicy="no-referrer".
 */
export function UserAvatar({
  src,
  name,
  width,
  height,
  className = "",
  fallbackVariant = "default",
}: {
  src?: string | null;
  name: string;
  width: number;
  height: number;
  className?: string;
  fallbackVariant?: "default" | "muted";
}) {
  const [broken, setBroken] = useState(false);
  const raw = typeof src === "string" ? src : "";
  const normalized = normalizePictureUrl(raw);
  const safeSrc = normalized && isSafeImageSrc(normalized) ? normalized : "";
  const showImage = Boolean(safeSrc) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [safeSrc]);

  const onError = useCallback(() => setBroken(true), []);

  const fallbackBg =
    fallbackVariant === "muted" ? "bg-hardwood-600" : "bg-court-700";

  const letter = (name?.trim().charAt(0) || "?").toUpperCase();
  const letterClass =
    width <= 28
      ? "text-xs leading-none"
      : width <= 36
        ? "text-sm leading-none"
        : "text-base leading-none md:text-lg";

  if (!showImage) {
    return (
      <div
        className={clsx(
          "flex flex-shrink-0 items-center justify-center rounded-full font-display font-bold text-white",
          fallbackBg,
          className,
        )}
        style={{ width, height, minWidth: width, minHeight: height }}
      >
        <span className={letterClass}>{letter}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: reliable avatars in <Link> rows + external CDNs
    <img
      src={safeSrc}
      alt={name || "User"}
      width={width}
      height={height}
      onError={onError}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={clsx("flex-shrink-0 rounded-full object-cover", className)}
    />
  );
}
