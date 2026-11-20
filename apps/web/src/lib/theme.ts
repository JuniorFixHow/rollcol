export const THEME_STORAGE_KEY = "rollcol-theme";

/**
 * Runs in <head> before the page paints, so a chosen theme never flashes the
 * other one first. Kept tiny and free of imports.
 */
export const themeScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
