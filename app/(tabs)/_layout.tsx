import { Tabs } from 'expo-router';
import { colors, font } from '../../lib/theme';

const titles = { chat: 'Chat', agent: 'Agent', apps: 'Apps', settings: 'Settings' } as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: font.sm },
        tabBarIconStyle: { display: 'none' },
        tabBarItemStyle: { justifyContent: 'center', minHeight: 44 },
      }}
    >
      {(Object.keys(titles) as (keyof typeof titles)[]).map((n) => (
        <Tabs.Screen key={n} name={n} options={{ title: titles[n] }} />
      ))}
    </Tabs>
  );
}
