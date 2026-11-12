import { useCallback, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Case from "./pages/Case";
import Cases from "./pages/Cases";
import How from "./pages/How";
import Landing from "./pages/Landing";
import Ledger from "./pages/Ledger";
import Overview from "./pages/Overview";
import Taksir from "./pages/Taksir";
import Verify from "./pages/Verify";
import { SceneCanvas } from "./scene/SceneCanvas";
import { Footer } from "./ui/Footer";
import { Header } from "./ui/Header";
import { Lens } from "./ui/Lens";
import { Menu } from "./ui/Menu";
import { PageTransition } from "./ui/PageTransition";
import { WalletProvider } from "./wallet/WalletProvider";

export function Shell() {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  return (
    <>
      <Header onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={close} />
      <PageTransition>
        {(location) => (
          <>
            <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/how" element={<How />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/taksir" element={<Taksir />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/case/:id" element={<Case />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {location.pathname !== "/" ? <Footer /> : null}
          </>
        )}
      </PageTransition>
      <Lens />
    </>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <HashRouter>
        <SceneCanvas>
          <Shell />
        </SceneCanvas>
      </HashRouter>
    </WalletProvider>
  );
}
