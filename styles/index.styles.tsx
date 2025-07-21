// styles/auth.styles.ts
import { Dimensions, StyleSheet } from "react-native";

const { width, height } = Dimensions.get("window");


export const styles = StyleSheet.create({
  container: {
    padding: 20,
    justifyContent: "center",
    alignItems: "stretch",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  tips: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonSpacing: {
    marginVertical: 10,
  },
  loadingContainer: {
    marginVertical: 20,
    alignItems: "center", // centers spinner horizontally
  },
  errorContainer: {
    marginVertical: 10,
  },
  errorText: {
    color: "red",
    textAlign: "center",
  },
});