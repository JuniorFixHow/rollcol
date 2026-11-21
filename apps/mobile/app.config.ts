import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Adds RollCol's permissions and native modules to app.json. app.json stays the
 * main file (eas init writes the project ID there); this only adds to it.
 *
 * Every permission explains exactly why RollCol asks, as Apple requires.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  // Android push notifications need Firebase's google-services.json. It is kept out of the
  // repository as an EAS file environment variable (see docs/testing/part-5b.md).
  const googleServices = process.env.GOOGLE_SERVICES_JSON;

  return {
    ...base,
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...base.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        "android.permission.VIBRATE",
      ],
      blockedPermissions: [
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
    },
    plugins: [
      ...(base.plugins ?? []),
      "expo-dev-client",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "RollCol uses your location when you check in to a class, to confirm you are in the lecture hall. Lecturers' locations set where students can check in. Your location is only read while you check in or start a session, never in the background.",
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "RollCol uses the camera to scan the check-in code on your lecturer's screen. No photos or videos are taken or saved.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "RollCol uses Face ID to confirm it is you before you check in, so nobody else can check in with your phone.",
        },
      ],
      [
        "expo-notifications",
        {
          color: "#0f6b62",
        },
      ],
    ],
  };
};
