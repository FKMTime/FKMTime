import { useSegments, useRouter } from "expo-router";
import { createContext, useContext, useEffect, useState } from "react";

type User = {
  username: string;
  token: string;
}

type AuthType = {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthType>({
  user: null,
  setUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

function useProtectedRoute(user: any) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";

    if (
      !user &&
      !inAuthGroup
    ) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, segments]);
}

export function AuthProvider({ children }: { children: JSX.Element }): JSX.Element {
    const [user, setUser] = useState<User | null>(null);

    useProtectedRoute(user);

    const authContext: AuthType = {
      user,
      setUser,
    };

  return <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>;
}