export function getImageUrl(path: string | null | undefined): string {
  if (!path) {
    // Return a standard placeholder image
    return "https://placehold.co/300?text=No+Image";
  }

  // If it's already an absolute URL or a base64 data string, return it as-is
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  // Prepend backend base URL if configured (e.g. VITE_API_URL in production)
  const apiBase = import.meta.env.VITE_API_URL || "";
  
  // Ensure we don't duplicate slashes
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const cleanBase = apiBase.replace(/\/$/, "");
  
  return `${cleanBase}${cleanPath}`;
}
