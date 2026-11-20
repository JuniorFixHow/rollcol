// Android shows the window background for a moment between the splash screen
// and the first screen. Expo writes one colour for both themes, so phones in
// dark mode flash light. This adds the dark colour for night mode.
const { AndroidConfig, withAndroidColorsNight } = require("expo/config-plugins");

/** @param {import("expo/config").ExpoConfig} config @param {{ color: string }} options */
module.exports = function withDarkWindowBackground(config, options) {
  return withAndroidColorsNight(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: "activityBackground",
      value: options.color,
    });
    return mod;
  });
};
