import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { styles } from "../../styles/PlantDetailsAiGenerated.styles";

// You can type navigation props if using React Navigation (optional)


export default function PlantDetails() {
  const { plantName, details } = useLocalSearchParams();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{plantName} Care Details</Text>
      <Text style={styles.detailsText}>{details}</Text>
    </ScrollView>
  );
}