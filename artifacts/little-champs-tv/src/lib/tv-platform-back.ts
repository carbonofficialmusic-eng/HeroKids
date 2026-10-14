type TvWindow = Pick<Window, 'close'> & {
  PalmSystem?: { platformBack?: () => void };
};

/**
 * LG's webOSTV.js platformBack delegates to PalmSystem.platformBack.
 * On webOS 5 this opens the Home launcher from the app's entry screen.
 * Keep the browser fallback so the regular /tv preview still works without
 * shipping or downloading the full webOSTV.js library.
 */
export function leaveTvToHome(tvWindow: TvWindow = window): void {
  if (typeof tvWindow.PalmSystem?.platformBack === 'function') {
    tvWindow.PalmSystem.platformBack();
  } else {
    tvWindow.close();
  }
}
