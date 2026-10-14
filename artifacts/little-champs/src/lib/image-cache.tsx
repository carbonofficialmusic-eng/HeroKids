import { useEffect, type ImgHTMLAttributes } from "react";

const warmImages = new Map<string, HTMLImageElement>();
const pendingImages = new Map<string, Promise<void>>();

export function warmImage(url: string): Promise<void> {
  if (warmImages.has(url)) return Promise.resolve();
  const pending = pendingImages.get(url);
  if (pending) return pending;
  if (typeof Image === "undefined") return Promise.resolve();

  const promise = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      warmImages.set(url, image);
      pendingImages.delete(url);
      resolve();
    };
    image.onerror = () => {
      pendingImages.delete(url);
      reject(new Error(`Failed to load image: ${url}`));
    };
    image.src = url;
  });
  pendingImages.set(url, promise);
  return promise;
}

export function warmImagesEarly(urls: readonly string[]): void {
  for (const url of urls) {
    void warmImage(url).catch(() => undefined);
  }
}

export function isImageWarm(url: string): boolean {
  return warmImages.has(url);
}

export function CachedImage({ src, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  useEffect(() => {
    if (!src) return;
    void warmImage(src).catch(() => undefined);
  }, [src]);

  return (
    <img
      {...props}
      src={src}
      onLoad={(event) => {
        if (!src) {
          onLoad?.(event);
          return;
        }
        void warmImage(src).catch(() => undefined);
        onLoad?.(event);
      }}
    />
  );
}