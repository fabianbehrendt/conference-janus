import React, { useContext, useEffect, useState } from "react";

interface IAppHeightProvider {
  children: React.ReactNode;
}

const AppHeightContext = React.createContext<undefined | number>(undefined);

const useAppHeight = () => {
  return useContext(AppHeightContext);
}

const AppHeightProvider: React.FunctionComponent<IAppHeightProvider> = props => {
  const [appHeight, setAppHeight] = useState<number>();

  useEffect(() => {
    setAppHeight(window.innerHeight);

    const resizeListener = () => {
      setAppHeight(window.innerHeight);
    };

    window.addEventListener("resize", resizeListener);

    return () => {
      window.removeEventListener("resize", resizeListener);
    }
  }, []);

  return (
    <AppHeightContext.Provider value={appHeight}>
      {props.children}
    </AppHeightContext.Provider>
  );
}

export {
  useAppHeight,
  AppHeightProvider,
}