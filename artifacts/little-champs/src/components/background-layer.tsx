import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Fixed artwork belongs outside #root's scrolling/clipping page descendants. */
export const BackgroundLayerContext = createContext<HTMLDivElement | null>(null);

export function BackgroundLayerPortal({ children }: { children: ReactNode }) {
  const layer = useContext(BackgroundLayerContext);
  return layer ? createPortal(children, layer) : null;
}
