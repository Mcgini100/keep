// CI sets KEEP_BUILD_NUMBER so every APK has a higher versionCode
// and installs straight over the previous one.
module.exports = ({ config }) => {
  const build = Number(process.env.KEEP_BUILD_NUMBER || 1);
  return {
    ...config,
    version: `1.0.${build}`,
    android: { ...config.android, versionCode: build },
  };
};
