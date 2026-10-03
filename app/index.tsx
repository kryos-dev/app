import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const APK_URL = 'https://github.com/kryos-dev/app/releases/latest/download/kryos.apk';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kryos</Text>
      <Text style={styles.text}>Your agent, your apps, one place.</Text>
      {Platform.OS === 'web' ? (
        <Pressable style={styles.button} onPress={() => Linking.openURL(APK_URL)}>
          <Text style={styles.buttonText}>Download Android app</Text>
        </Pressable>
      ) : (
        <Text style={styles.text}>Signed in as nobody yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#08090a',
  },
  title: { color: '#e7e7e7', fontSize: 32, fontWeight: '600' },
  text: { color: '#e7e7e7', fontSize: 16 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7e7e7',
  },
  buttonText: { color: '#e7e7e7', fontSize: 16 },
});
