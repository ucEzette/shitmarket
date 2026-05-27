/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import IntroScreen from "./components/IntroScreen";
import DegenGame from "./components/DegenGame";

export default function App() {
  const [view, setView] = useState<"INTRO" | "GAME">("INTRO");
  const [isGodMode, setIsGodMode] = useState<boolean>(false);

  const handleSkipIntro = (unlockedCheat: boolean) => {
    setIsGodMode(unlockedCheat);
    setView("GAME");
  };

  return (
    <div className="w-screen h-screen bg-[#071105] flex items-center justify-center p-2 md:p-4 select-none">
      <div className="w-full h-full max-w-7xl max-h-[850px] relative overflow-hidden bg-black rounded-xl border-4 border-mud-brown shadow-2xl flex flex-col justify-between">
        {view === "INTRO" ? (
          <IntroScreen onSkip={handleSkipIntro} />
        ) : (
          <DegenGame goBackToIntro={() => setView("INTRO")} isGodMode={isGodMode} />
        )}
      </div>
    </div>
  );
}

