import { createContext, useContext } from 'react';
import { setGatewayKey } from './api/http';
import { revealEnv } from './api/dashboard';

export const AuthContext = createContext<{ signedIn: boolean; setSignedIn: (v: boolean) => void }>({
  signedIn: false,
  setSignedIn: () => {},
});
export const useAuth = () => useContext(AuthContext);

/** Fetch the gateway key from the dashboard session and persist it. */
export async function revealAndStoreGatewayKey(): Promise<void> {
  await setGatewayKey((await revealEnv('API_SERVER_KEY')).value);
}
