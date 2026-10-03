import { FlatList, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Row, Screen, Text } from '../../components/ui';
import { apps } from '../../lib/apps';

export default function Apps() {
  const router = useRouter();
  const open = (id: string, url: string) => {
    if (Platform.OS === 'web') window.location.assign(url);
    else router.push(`/apps/${id}` as Href);
  };
  return (
    <Screen>
      <Text variant="title">Apps</Text>
      <FlatList
        data={apps}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        renderItem={({ item }) => <Row title={item.name} subtitle={item.description} onPress={() => open(item.id, item.url)} />}
      />
    </Screen>
  );
}
