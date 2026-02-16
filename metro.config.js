const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// This tells Metro: "Tailwind starts at global.css"
module.exports = withNativeWind(config, { input: "./global.css" });