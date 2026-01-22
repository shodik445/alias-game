import { useState, useEffect, useCallback } from 'react';
import { wordBank } from './words';
import type { GameState, Word, Team } from './types';

// Random Team Name Pools
const teamNamesUz = ["Sherlar", "Burgutlar", "Lochinlar", "Alpomishlar", "Chavandozlar", "Vityazlar"];
const teamNamesEn = ["Lions", "Eagles", "Falcons", "Warriors", "Riders", "Wolves"];

function App() {
  // 1. Navigation & Settings State
  const [gameState, setGameState] = useState<GameState | 'LANG_SELECT' | 'SETTINGS'>('LANG_SELECT');
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [hasSkipPenalty, setHasSkipPenalty] = useState(true);
  const [winningScore, setWinningScore] = useState(50);
  const [roundDuration, setRoundDuration] = useState(60); // MOVED INSIDE
  
  // 2. Gameplay State
  const [teams, setTeams] = useState<Team[]>([
    { name: 'Team 1', score: 0 },
    { name: 'Team 2', score: 0 }
  ]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // REMOVED DUPLICATE

  // 3. Game Logic Functions
  const getRandomWord = useCallback(() => {
    const words = wordBank[language];
    return words[Math.floor(Math.random() * words.length)];
  }, [language]);

  const finishRound = useCallback(() => {
    setTeams((prevTeams) => {
      const updatedTeams = [...prevTeams];
      const newScore = updatedTeams[currentTeamIndex].score + roundScore;
      
      updatedTeams[currentTeamIndex] = { 
        ...updatedTeams[currentTeamIndex], 
        score: newScore 
      };

      if (newScore >= winningScore) {
        setGameState('GAME_OVER');
      } else {
        setGameState('REVIEW');
      }
      return updatedTeams;
    });
  }, [currentTeamIndex, roundScore, winningScore]);

  // 4. Timer Logic
  useEffect(() => {
    let interval: number;
    if (gameState === 'PLAYING' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, timeLeft]);

  // 4b. Handle Round End When Time Expires
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'PLAYING') {
      const timer = setTimeout(() => {
        finishRound();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState, finishRound]);

  // 5. User Interaction Handlers
  const setupGame = (selectedLang: 'uz' | 'en') => {
    setLanguage(selectedLang);
    const pool = selectedLang === 'uz' ? teamNamesUz : teamNamesEn;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setTeams([
      { name: shuffled[0], score: 0 },
      { name: shuffled[1], score: 0 }
    ]);
    setGameState('SETTINGS');
  };

  const startRound = () => {
    setRoundScore(0);
    setTimeLeft(roundDuration); // Uses the custom duration set in menu
    setCurrentWord(getRandomWord());
    setGameState('PLAYING');
  };

  const handleAction = (isCorrect: boolean) => {
    if (isCorrect) {
      setRoundScore(prev => prev + 1);
    } else if (hasSkipPenalty) {
      setRoundScore(prev => prev - 1);
    }
    setCurrentWord(getRandomWord());
  };

  const nextTurn = () => {
    setCurrentTeamIndex((prev) => (prev === 0 ? 1 : 0));
    setGameState('START');
  };

  // 6. UI Render (Same as yours, but ensured clean integration)
  return (
    <div style={styles.container}>
      
      {gameState === 'LANG_SELECT' && (
        <div style={styles.fullScreenCenter}>
          <h1 style={styles.brandTitle}>ALIAS</h1>
          <p style={styles.subtitle}>Tilni tanlang / Choose Language</p>
          <button style={styles.mainButton} onClick={() => setupGame('uz')}>O'zbekcha</button>
          <button style={{...styles.mainButton, marginTop: '15px'}} onClick={() => setupGame('en')}>English</button>
        </div>
      )}

      {gameState === 'SETTINGS' && (
        <div style={styles.fullScreenCenter}>
          <h2 style={styles.title}>{teams[0].name} vs {teams[1].name}</h2>
          
          <div style={styles.settingsBox}>
            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "Vaqt (soniya):" : "Round Time (sec):"}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setRoundDuration(prev => Math.max(30, prev - 30))} style={styles.smallCircleBtn}>-</button>
                <span style={{ fontWeight: 'bold', fontSize: '20px' }}>{roundDuration}</span>
                <button onClick={() => setRoundDuration(prev => Math.min(300, prev + 30))} style={styles.smallCircleBtn}>+</button>
              </div>
            </div>

            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "Jarima (-1):" : "Skip Penalty (-1):"}</span>
              <input type="checkbox" checked={hasSkipPenalty} onChange={() => setHasSkipPenalty(!hasSkipPenalty)} style={styles.checkbox}/>
            </div>
            
            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "G'alaba ochkosi:" : "Winning Score:"}</span>
              <input type="number" value={winningScore} onChange={(e) => setWinningScore(Number(e.target.value))} style={styles.numberInput}/>
            </div>
          </div>

          <button style={styles.mainButton} onClick={() => setGameState('START')}>DAVOM ETISH</button>
        </div>
      )}

      {gameState === 'START' && (
        <div style={styles.gameContent}>
          <div style={styles.scoreHeader}>
             {teams.map((t, i) => (
               <div key={i} style={currentTeamIndex === i ? styles.activeBadge : styles.inactiveBadge}>
                 {t.name}: {t.score}
               </div>
             ))}
          </div>
          <div style={styles.centerBox}>
            <h2 style={styles.hugeText}>{teams[currentTeamIndex].name}</h2>
            <p style={{fontSize: '20px'}}>{language === 'uz' ? "Tayyormisiz?" : "Are you ready?"}</p>
          </div>
          <button onClick={startRound} style={styles.bottomButton}>START</button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div style={styles.gameContent}>
          <div style={styles.playHeader}>
            <div style={styles.timerVal}>{timeLeft}s</div>
            <div style={styles.roundPoints}>Score: {roundScore}</div>
          </div>

          <div style={styles.timerContainer}>
            <div style={{
              ...styles.timerProgress, 
              width: `${(timeLeft / roundDuration) * 100}%`
            }}></div>
          </div>
          
          <div style={styles.wordArea}>
            <h1 style={styles.wordText}>{currentWord?.text}</h1>
          </div>

          <div style={styles.actionArea}>
            <button onClick={() => handleAction(true)} style={styles.correctBtn}>TO'G'RI</button>
            <button onClick={() => handleAction(false)} style={styles.skipBtn}>O'TKAZIB YUBORISH</button>
          </div>
        </div>
      )}

      {gameState === 'REVIEW' && (
        <div style={styles.fullScreenCenter}>
          <h2 style={{color: '#94a3b8'}}>{language === 'uz' ? "Raund tugadi!" : "Round Over!"}</h2>
          <div style={styles.resultDisplay}>+{roundScore}</div>
          <button onClick={nextTurn} style={styles.mainButton}>
            {language === 'uz' ? "KEYINGI JAMOA" : "NEXT TEAM"}
          </button>
        </div>
      )}

      {gameState === 'GAME_OVER' && (
        <div style={styles.fullScreenCenter}>
          <h1 style={styles.brandTitle}>G'ALABA!</h1>
          <h2 style={{color: '#38bdf8'}}>{teams[currentTeamIndex].name} WINS!</h2>
          <button onClick={() => setGameState('LANG_SELECT')} style={styles.mainButton}>MENU</button>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  fullScreenCenter: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' },
  brandTitle: { fontSize: '72px', fontWeight: '900', color: '#38bdf8', margin: '0' },
  subtitle: { color: '#94a3b8', marginBottom: '30px', fontSize: '18px' },
  mainButton: { width: '100%', padding: '20px', borderRadius: '16px', border: 'none', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
  settingsBox: { width: '100%', backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '20px' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px' },
  checkbox: { width: '24px', height: '24px' },
  numberInput: { width: '60px', padding: '5px', borderRadius: '5px', border: 'none', textAlign: 'center' },
  gameContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  scoreHeader: { display: 'flex', justifyContent: 'space-around', padding: '20px' },
  activeBadge: { color: '#38bdf8', borderBottom: '3px solid #38bdf8', paddingBottom: '5px', fontWeight: 'bold' },
  inactiveBadge: { opacity: 0.4 },
  centerBox: { textAlign: 'center' },
  hugeText: { fontSize: '56px', color: '#38bdf8', margin: '0' },
  bottomButton: { width: '100%', padding: '30px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: '900', fontSize: '24px', letterSpacing: '2px' },
  playHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', alignItems: 'center' },
  timerVal: { fontSize: '36px', fontWeight: 'bold', color: '#fb7185' },
  roundPoints: { fontSize: '24px', fontWeight: 'bold' },
  wordArea: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  wordText: { fontSize: '64px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', margin: '0' },
  timerContainer: { width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', margin: '0 20px' },
  timerProgress: { height: '100%', backgroundColor: '#38bdf8', transition: 'width 1s linear' },
  actionArea: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' },
  correctBtn: { padding: '35px', borderRadius: '20px', border: 'none', backgroundColor: '#22c55e', color: '#fff', fontSize: '24px', fontWeight: 'bold' },
  skipBtn: { padding: '20px', borderRadius: '20px', border: 'none', backgroundColor: '#475569', color: '#fff', fontSize: '16px', fontWeight: 'bold' },
  resultDisplay: { fontSize: '80px', fontWeight: 'bold', color: '#22c55e', marginBottom: '40px' },
  smallCircleBtn: { width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: '#38bdf8', color: '#0f172a', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default App;