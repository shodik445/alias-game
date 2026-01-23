import { useState, useEffect, useCallback, useRef } from 'react';
import { wordBank } from './words';
import type { GameState, Word, Team } from './types';

// Types for our Review system
interface RoundAttempt {
  word: Word;
  isCorrect: boolean;
}

const teamNamesUz = ["Sherlar", "Burgutlar", "Lochinlar", "Alpomishlar", "Chavandozlar", "Vityazlar"];
const teamNamesEn = ["Lions", "Eagles", "Falcons", "Warriors", "Riders", "Wolves"];

function App() {
  const [gameState, setGameState] = useState<GameState | 'LANG_SELECT' | 'SETTINGS'>('LANG_SELECT');
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [hasSkipPenalty, setHasSkipPenalty] = useState(true);

  const [roundDuration, setRoundDuration] = useState(60);

  const [winningScore, setWinningScore] = useState(50);
  
  const [teams, setTeams] = useState<Team[]>([{ name: '1-Jamoa', score: 0 }, { name: '2-Jamoa', score: 0 }]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [usedWordIds, setUsedWordIds] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);

  // NEW: History tracking for the Review screen
  const [roundHistory, setRoundHistory] = useState<RoundAttempt[]>([]);

  // Sound Refs
  const correctSound = useRef(new Audio('/correct.mp3'));
  const skipSound = useRef(new Audio('/skip.mp3'));
  const endSound = useRef(new Audio('/times-up.mp3'));

  const getRandomWord = useCallback(() => {
    const allWords = wordBank[language] || [];
    const availableWords = allWords.filter(w => !usedWordIds.includes(w.id));
    if (availableWords.length === 0) {
      setUsedWordIds([]);
      return allWords[Math.floor(Math.random() * allWords.length)];
    }
    const selected = availableWords[Math.floor(Math.random() * availableWords.length)];
    setUsedWordIds(prev => [...prev, selected.id]);
    return selected;
  }, [language, usedWordIds]);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (gameState === 'PLAYING' && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'PLAYING') {
      endSound.current.play();
      setTimeout(() => setGameState('REVIEW'), 0);
    }
    return () => clearInterval(interval);
  }, [gameState, timeLeft]);

  const setupGame = (selectedLang: 'uz' | 'en') => {
    setLanguage(selectedLang);
    const pool = selectedLang === 'uz' ? teamNamesUz : teamNamesEn;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setTeams([{ name: shuffled[0], score: 0 }, { name: shuffled[1], score: 0 }]);
    setGameState('SETTINGS');
  };

  const startRound = () => {
    setRoundHistory([]);
    setTimeLeft(roundDuration);
    setCurrentWord(getRandomWord());
    setGameState('PLAYING');
  };

  const handleAction = (isCorrect: boolean) => {
    if (isCorrect) correctSound.current.play();
    else skipSound.current.play();

    if (currentWord) {
      setRoundHistory(prev => [...prev, { word: currentWord, isCorrect }]);
    }
    setCurrentWord(getRandomWord());
  };

  // Toggle status during review
  const toggleReviewStatus = (index: number) => {
    const newHistory = [...roundHistory];
    newHistory[index].isCorrect = !newHistory[index].isCorrect;
    setRoundHistory(newHistory);
  };

  const finalizeRound = () => {
    // Calculate final round score from history
    const finalRoundScore = roundHistory.reduce((acc, curr) => {
      if (curr.isCorrect) return acc + 1;
      return hasSkipPenalty ? acc - 1 : acc;
    }, 0);

    const newTeams = [...teams];
    newTeams[currentTeamIndex].score += finalRoundScore;
    setTeams(newTeams);

    if (newTeams[currentTeamIndex].score >= winningScore) {
      setGameState('GAME_OVER');
    } else {
      setCurrentTeamIndex(p => p === 0 ? 1 : 0);
      setGameState('START');
    }
  };

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

            <span>{language === 'uz' ? "G'alaba balli:" : "Winning Score:"}</span>
            <div style={styles.flexCenter}>
              <button 
                onClick={() => setWinningScore(prev => Math.max(10, prev - 10))} 
                style={styles.circleBtn}
              >-</button>
              <span style={{margin: '0 15px', fontWeight: 'bold'}}>{winningScore}</span>
              <button 
                onClick={() => setWinningScore(prev => Math.min(500, prev + 10))} 
                style={styles.circleBtn}
              >+</button>
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
          <div style={styles.scoreRow}>{teams.map((t, i) => <div key={i} style={currentTeamIndex === i ? styles.activeT : {}}>{t.name}: {t.score}</div>)}</div>
          <div style={styles.centerBox}><h1 style={styles.hugeText}>{teams[currentTeamIndex].name}</h1><p>Tayyormisiz?</p></div>
          <button onClick={startRound} style={styles.bottomButton}>BOSHLASH</button>
        </div>
      )}

      {/* 4. ACTIVE PLAYING */}
      {gameState === 'PLAYING' && (
        <div style={styles.gameContent}>
          <div style={styles.playHeader}><div style={{color: '#fb7185'}}>{timeLeft}s</div><div>Ball: {roundHistory.filter(h => h.isCorrect).length - (hasSkipPenalty ? roundHistory.filter(h => !h.isCorrect).length : 0)}</div></div>
          <div style={styles.timerBar}><div style={{...styles.timerProgress, width: `${(timeLeft/roundDuration)*100}%`}}></div></div>
          <div style={styles.wordArea}><h1 style={styles.wordText}>{currentWord?.text}</h1></div>
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

const styles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100dvh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  fullScreenCenter: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' },
  brandTitle: { fontSize: '72px', fontWeight: '900', color: '#38bdf8', marginBottom: '20px' },
  mainButton: { width: '100%', padding: '20px', borderRadius: '16px', border: 'none', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold', fontSize: '20px' },
  settingsBox: { width: '100%', backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', marginBottom: '40px' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0', fontSize: '18px' },
  flexCenter: { display: 'flex', alignItems: 'center' },
  circleBtn: { width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: '#38bdf8', fontWeight: 'bold', fontSize: '20px' },
  checkbox: { width: '24px', height: '24px' },
  gameContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' },
  scoreRow: { display: 'flex', justifyContent: 'space-around', padding: '20px', fontSize: '18px' },
  activeT: { color: '#38bdf8', borderBottom: '2px solid #38bdf8' },
  centerBox: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
  hugeText: { fontSize: '60px', color: '#38bdf8', margin: 0 },
  bottomButton: { padding: '25px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: 'bold', fontSize: '20px' },
  playHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', fontSize: '28px', fontWeight: 'bold' },
  timerBar: { height: '8px', backgroundColor: '#1e293b', margin: '0 20px', borderRadius: '4px', overflow: 'hidden' },
  timerProgress: { height: '100%', backgroundColor: '#38bdf8', transition: 'width 1s linear' },
  wordArea: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' },
  wordText: { fontSize: 'clamp(32px, 12vw, 64px)', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
  actionArea: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' },
  correctBtn: { padding: '30px', borderRadius: '16px', backgroundColor: '#22c55e', border: 'none', color: '#fff', fontSize: '24px', fontWeight: 'bold' },
  skipBtn: { padding: '20px', borderRadius: '16px', backgroundColor: '#475569', border: 'none', color: '#fff', fontSize: '18px' },
  reviewList: { flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  reviewItem: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderRadius: '12px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' },
  title: { marginBottom: '20px', color: '#38bdf8' }
};

export default App;