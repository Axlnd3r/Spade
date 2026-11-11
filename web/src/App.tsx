import { useCallback, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Case from "./pages/Case";
import Cases from "./pages/Cases";
import Home from "./pages/Home";
import Ledger from "./pages/Ledger";
import Taksir from "./pages/Taksir";
import Verify from "./pages/Verify";
import { SceneCanvas } from "./scene/SceneCanvas";
import { Footer } from "./ui/Footer";
import { Header } from "./ui/Header";
import { Menu } from "./ui/Menu";
import { WalletProvider } from "./wallet/WalletProvider";

export function Shell() {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  return (
    <>
      <Header onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={close} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/taksir" element={<Taksir />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/case/:id" element={<Case />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
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
