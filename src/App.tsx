import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { wordBank } from './words';
import type { GameState, Word, Team } from './types';

// Internal Types
interface RoundAttempt {
  word: Word;
  isCorrect: boolean;
}

const teamNamesUz = ["Chumoli ovoz Sherlar", "Birko'zli Burgutlar", "Hasharotxo'r Lochinlar", 
                    "Yovuz Quyonchalar", "Otqochar Chavandozlar","Ozg'in Pandalar",
                    "Tezkor Shilliqqurtlar", "Qo'nxo'r Qo'ylar"];
const teamNamesEn = ["Lions", "Eagles", "Falcons", "Warriors", "Riders", "Wolves"];

// Helper: Fisher-Yates Shuffle for O(n) randomization
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function App() {
  // Game Configuration
  const [gameState, setGameState] = useState<GameState | 'LANG_SELECT' | 'SETTINGS'>('LANG_SELECT');
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [hasSkipPenalty, setHasSkipPenalty] = useState(true);
  const [roundDuration, setRoundDuration] = useState(60);
  const [winningScore, setWinningScore] = useState(50);

  // Game Logic State
  const [teams, setTeams] = useState<Team[]>([{ name: '1-Jamoa', score: 0 }, { name: '2-Jamoa', score: 0 }]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // OPTIMIZATION: Use a shuffled deck instead of filtering used IDs every turn
  const [wordDeck, setWordDeck] = useState<Word[]>([]);
  const [roundHistory, setRoundHistory] = useState<RoundAttempt[]>([]);
  console.log(wordDeck);
  // Sound Refs
  const correctSound = useRef(new Audio('/correct.mp3'));
  const skipSound = useRef(new Audio('/skip.mp3'));
  const endSound = useRef(new Audio('/times-up.mp3'));

  // Setup the game environment
  const setupGame = (selectedLang: 'uz' | 'en') => {
    setLanguage(selectedLang);
    
    // Shuffle the entire bank once
    const fullBank = wordBank[selectedLang] || [];
    setWordDeck(shuffleArray(fullBank));

    const names = selectedLang === 'uz' ? teamNamesUz : teamNamesEn;
    const shuffledNames = shuffleArray(names);
    setTeams([
      { name: shuffledNames[0], score: 0 },
      { name: shuffledNames[1], score: 0 }
    ]);
    setGameState('SETTINGS');
  };

  // Logic to pop the next word (O(1) complexity)
  const getNextWord = useCallback(() => {
    setWordDeck(prevDeck => {
      const newDeck = [...prevDeck];
      const next = newDeck.pop();
      
      // If we run out of words, reshuffle the original bank
      if (!next) {
        const freshDeck = shuffleArray(wordBank[language]);
        const fallback = freshDeck.pop();
        setCurrentWord(fallback || null);
        return freshDeck;
      }

      setCurrentWord(next);
      return newDeck;
    });
  }, [language]);

  // Timer Logic: Optimized to only run when PLAYING
  useEffect(() => {
    let interval: number;
    if (gameState === 'PLAYING') {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            endSound.current.play();
            setGameState('REVIEW');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const startRound = () => {
    setRoundHistory([]);
    setTimeLeft(roundDuration);
    getNextWord(); // Get first word
    setGameState('PLAYING');
  };

  const handleAction = (isCorrect: boolean) => {
    // Sound handling with reset to prevent delay
    const sound = isCorrect ? correctSound.current : skipSound.current;
    sound.currentTime = 0;
    sound.play().catch(() => {}); // Catch block prevents issues with browser auto-play policies

    if (currentWord) {
      setRoundHistory(prev => [...prev, { word: currentWord, isCorrect }]);
    }
    getNextWord();
  };

  const toggleReviewStatus = (index: number) => {
    setRoundHistory(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isCorrect: !updated[index].isCorrect };
      return updated;
    });
  };

  const finalizeRound = () => {
    const roundPoints = roundHistory.reduce((acc, curr) => {
      if (curr.isCorrect) return acc + 1;
      return hasSkipPenalty ? acc - 1 : acc;
    }, 0);

    const updatedTeams = [...teams];
    updatedTeams[currentTeamIndex].score += roundPoints;
    setTeams(updatedTeams);

    if (updatedTeams[currentTeamIndex].score >= winningScore) {
      setGameState('GAME_OVER');
    } else {
      setCurrentTeamIndex(prev => (prev === 0 ? 1 : 0));
      setGameState('START');
    }
  };

  // Live Score Calculation for the UI
  const currentRoundScore = useMemo(() => {
    return roundHistory.reduce((acc, curr) => {
      if (curr.isCorrect) return acc + 1;
      return hasSkipPenalty ? acc - 1 : acc;
    }, 0);
  }, [roundHistory, hasSkipPenalty]);

  return (
    <div style={styles.container}>
      {/* 1. LANGUAGE SELECTION */}
      {gameState === 'LANG_SELECT' && (
        <div style={styles.fullScreenCenter}>
          <h1 style={styles.brandTitle}>ALIAS</h1>
          <button style={styles.mainButton} onClick={() => setupGame('uz')}>O'zbekcha</button>
          <button style={{...styles.mainButton, marginTop: '15px'}} onClick={() => setupGame('en')}>English</button>
        </div>
      )}

      {/* 2. SETTINGS */}
      {gameState === 'SETTINGS' && (
        <div style={styles.fullScreenCenter}>
          <h2 style={styles.title}>{teams[0].name} vs {teams[1].name}</h2>
          <div style={styles.settingsBox}>
            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "Vaqt:" : "Time:"}</span>
              <div style={styles.flexCenter}>
                <button onClick={() => setRoundDuration(p => Math.max(30, p - 30))} style={styles.circleBtn}>-</button>
                <span style={{margin: '0 15px'}}>{roundDuration}s</span>
                <button onClick={() => setRoundDuration(p => Math.min(300, p + 30))} style={styles.circleBtn}>+</button>
              </div>
            </div>
            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "G'alaba balli:" : "Winning Score:"}</span>
              <div style={styles.flexCenter}>
                <button onClick={() => setWinningScore(p => Math.max(10, p - 10))} style={styles.circleBtn}>-</button>
                <span style={{margin: '0 15px', fontWeight: 'bold'}}>{winningScore}</span>
                <button onClick={() => setWinningScore(p => Math.min(500, p + 10))} style={styles.circleBtn}>+</button>
              </div>
            </div>
            <div style={styles.settingRow}>
              <span>{language === 'uz' ? "Jarima (-1):" : "Penalty (-1):"}</span>
              <input type="checkbox" checked={hasSkipPenalty} onChange={() => setHasSkipPenalty(!hasSkipPenalty)} style={styles.checkbox}/>
            </div>
          </div>
          <button style={styles.mainButton} onClick={() => setGameState('START')}>DAVOM ETISH</button>
        </div>
      )}

      {/* 3. READY SCREEN */}
      {gameState === 'START' && (
        <div style={styles.gameContent}>
          <div style={styles.scoreRow}>
            {teams.map((t, i) => (
              <div key={i} style={currentTeamIndex === i ? styles.activeT : {}}>
                {t.name}: {t.score}
              </div>
            ))}
          </div>
          <div style={styles.centerBox}>
            <h1 style={styles.hugeText}>{teams[currentTeamIndex].name}</h1>
            <p>{language === 'uz' ? 'Tayyormisiz?' : 'Ready?'}</p>
          </div>
          <button onClick={startRound} style={styles.bottomButton}>BOSHLASH</button>
        </div>
      )}

      {/* 4. ACTIVE PLAYING */}
      {gameState === 'PLAYING' && (
        <div style={styles.gameContent}>
          <div style={styles.playHeader}>
            <div style={{color: '#fb7185'}}>{timeLeft}s</div>
            <div>Ball: {currentRoundScore}</div>
          </div>
          <div style={styles.timerBar}>
            <div style={{...styles.timerProgress, width: `${(timeLeft / roundDuration) * 100}%`}}></div>
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

      {/* 5. ROUND REVIEW SCREEN */}
      {gameState === 'REVIEW' && (
        <div style={styles.gameContent}>
          <h2 style={{textAlign: 'center', padding: '20px'}}>{language === 'uz' ? "Natijalarni tekshiring" : "Check Results"}</h2>
          <div style={styles.reviewList}>
            {roundHistory.map((item, index) => (
              <div key={index} onClick={() => toggleReviewStatus(index)} style={{
                ...styles.reviewItem,
                backgroundColor: item.isCorrect ? '#dcfce7' : '#fee2e2',
                color: item.isCorrect ? '#166534' : '#991b1b'
              }}>
                <span>{item.word.text}</span>
                <span>{item.isCorrect ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>
          <button onClick={finalizeRound} style={styles.bottomButton}>TASDIQLASH (CONFIRM)</button>
        </div>
      )}

      {/* 6. GAME OVER */}
      {gameState === 'GAME_OVER' && (
        <div style={styles.fullScreenCenter}>
          <h1 style={styles.brandTitle}>G'ALABA!</h1>
          <h2>{teams[currentTeamIndex].name} g'olib bo'ldi!</h2>
          <button onClick={() => setGameState('LANG_SELECT')} style={styles.mainButton}>MENU</button>
        </div>
      )}
    </div>
  );
}

// Styles object remains largely the same but ensured for responsiveness
const styles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100dvh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  fullScreenCenter: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' },
  brandTitle: { fontSize: '72px', fontWeight: '900', color: '#38bdf8', marginBottom: '20px' },
  mainButton: { width: '100%', padding: '20px', borderRadius: '16px', border: 'none', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
  settingsBox: { width: '100%', maxWidth: '400px', backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', marginBottom: '40px' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0', fontSize: '18px' },
  flexCenter: { display: 'flex', alignItems: 'center' },
  circleBtn: { width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: '#38bdf8', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
  checkbox: { width: '24px', height: '24px' },
  gameContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' },
  scoreRow: { display: 'flex', justifyContent: 'space-around', padding: '20px', fontSize: '18px' },
  activeT: { color: '#38bdf8', borderBottom: '2px solid #38bdf8', fontWeight: 'bold' },
  centerBox: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
  hugeText: { fontSize: '60px', color: '#38bdf8', margin: 0, textAlign: 'center' },
  bottomButton: { padding: '25px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
  playHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', fontSize: '28px', fontWeight: 'bold' },
  timerBar: { height: '8px', backgroundColor: '#1e293b', margin: '0 20px', borderRadius: '4px', overflow: 'hidden' },
  timerProgress: { height: '100%', backgroundColor: '#38bdf8', transition: 'width 1s linear' },
  wordArea: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 20px' },
  wordText: { fontSize: 'clamp(32px, 12vw, 64px)', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
  actionArea: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' },
  correctBtn: { padding: '30px', borderRadius: '16px', backgroundColor: '#22c55e', border: 'none', color: '#fff', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' },
  skipBtn: { padding: '20px', borderRadius: '16px', backgroundColor: '#475569', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' },
  reviewList: { flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  reviewItem: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderRadius: '12px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' },
  title: { marginBottom: '20px', color: '#38bdf8' }
};

export default App;