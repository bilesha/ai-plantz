import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f0f9f0",
    borderRadius: 8,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
    fontStyle: "italic",
  },
  errorText: {
    color: "red",
    fontWeight: "bold",
  },
  detailText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#2a6f2a",
  },
});

export default styles;