import React, { useContext, useEffect, useState } from "react";

interface IAuthContext {
  adminKey: undefined | string;
  setAdminKey: (adminKey: string) => void;
  isAdminKeyWrong: boolean;
  setIsAdminKeyWrong: (isWrong: boolean) => void;
}

const AuthContext = React.createContext<IAuthContext>({
  adminKey: undefined,
  setAdminKey: () => { },
  isAdminKeyWrong: false,
  setIsAdminKeyWrong: () => {},
});

interface IAuthContextProvider {
  children: React.ReactNode;
}

const useAuth = () => {
  return useContext(AuthContext);
}

const AuthContextProvider: React.FunctionComponent<IAuthContextProvider> = props => {
  const [adminKey, setAdminKey] = useState<string>();
  const [isAdminKeyWrong, setIsAdminKeyWrong] = useState<boolean>(false);

  return (
    <AuthContext.Provider
      value={{
        adminKey: adminKey,
        setAdminKey: adminKey => setAdminKey(adminKey),
        isAdminKeyWrong: isAdminKeyWrong,
        setIsAdminKeyWrong: isWrong => setIsAdminKeyWrong(isWrong),
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
}

export {
  useAuth,
  AuthContextProvider,
}