import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Link href="/" style={styles.link}>
        Nothing here. Back home.
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090a' },
  link: { color: '#e7e7e7', fontSize: 16 },
});
