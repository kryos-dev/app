import { createContext, useContext } from 'react';

export const AuthContext = createContext<{ signedIn: boolean; setSignedIn: (v: boolean) => void }>({
  signedIn: false,
  setSignedIn: () => {},
});
export const useAuth = () => useContext(AuthContext);
