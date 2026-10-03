export interface AppEntry {
  id: string;
  name: string;
  url: string;
  description: string;
}

export const apps: AppEntry[] = [
  { id: 'menaka', name: 'Menaka', url: 'https://menaka.kryos.dev', description: 'Menaka' },
  { id: 'files', name: 'Files', url: 'https://files.kryos.dev', description: 'File browser' },
  { id: 'vault', name: 'Vault', url: 'https://vault.kryos.dev', description: 'Password vault' },
  { id: 'ntfy', name: 'ntfy', url: 'https://ntfy.kryos.dev', description: 'Notifications' },
  { id: 'n8n', name: 'n8n', url: 'https://n8n.kryos.dev', description: 'Workflow automation' },
  { id: 'memos', name: 'Memos', url: 'https://memos.kryos.dev', description: 'Notes' },
  { id: 'hermes', name: 'Hermes', url: 'https://hermes.kryos.dev', description: 'Hermes dashboard' },
];
