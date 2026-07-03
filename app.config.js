export default {
  expo: {
    name: "Rootnote",
    slug: "rootnote",
    scheme: "rootnote",
    version: "1.0.0",
    userInterfaceStyle: "automatic",
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#059669',
    },
    plugins: [
      [
        "expo-notifications",
        {
          color: "#059669",
        },
      ],
    ],
  },
}; 