import React, { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/image";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export function ImageWithFallback({
  src,
  alt,
  fallbackSrc = "https://placehold.co/300?text=No+Image",
  onError,
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  // If the src changes, reset the error state so it tries to load the new image
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedSrc = hasError ? fallbackSrc : getImageUrl(src);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`[ImageError] Failed to load image: "${src}" (resolved to: "${resolvedSrc}"). Falling back to placeholder.`);
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
}

export default ImageWithFallback;
