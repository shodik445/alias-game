import { useState, useEffect, useCallback } from 'react';
import { wordBank } from './words';
import type { GameState, Word, Team } from './types';

function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [teams, setTeams] = useState<Team[]>([
    { name: 'Team A', score: 0 },
    { name: 'Team B', score: 0 }
  ]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const finishRound = useCallback(() => {
    const newTeams = [...teams];
    newTeams[currentTeamIndex].score += roundScore;
    setTeams(newTeams);
    setGameState('REVIEW');
  }, [teams, currentTeamIndex, roundScore]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          finishRound();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, finishRound]);

  const getRandomWord = () => {
    const words = wordBank[language];
    return words[Math.floor(Math.random() * words.length)];
  };

  const startRound = () => {
    setRoundScore(0);
    setTimeLeft(60);
    setCurrentWord(getRandomWord());
    setGameState('PLAYING');
  };

  const handleAction = (isCorrect: boolean) => {
    setRoundScore(prev => isCorrect ? prev + 1 : prev - 1);
    setCurrentWord(getRandomWord());
  };

  const nextTurn = () => {
    setCurrentTeamIndex((prev) => (prev === 0 ? 1 : 0));
    setGameState('START');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>ALIAS UZ</h1>
        <div style={styles.teamContainer}>
          {teams.map((t, i) => (
            <div key={i} style={{
              ...styles.teamBadge, 
              borderBottom: currentTeamIndex === i ? '4px solid #3498db' : 'none',
              opacity: currentTeamIndex === i ? 1 : 0.6
            }}>
              {t.name}: {t.score}
            </div>
          ))}
        </div>
      </header>

      {gameState === 'START' && (
        <div style={styles.card}>
          <h2 style={styles.turnTitle}>{teams[currentTeamIndex].name} tayyormisiz?</h2>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as 'uz' | 'en')}
            style={styles.langSelect}
          >
            <option value="uz">O'zbekcha</option>
            <option value="en">English</option>
          </select>
          <button onClick={startRound} style={styles.mainButton}>BOSHLASH</button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div style={styles.card}>
          <div style={styles.timerContainer}>
            <div style={{...styles.timerProgress, width: `${(timeLeft/60)*100}%`}}></div>
          </div>
          <div style={styles.timerVal}>{timeLeft}s</div>
          <div style={styles.word}>{currentWord?.text}</div>
          <div style={styles.btnRow}>
            <button onClick={() => handleAction(true)} style={styles.correctBtn}>TO'G'RI</button>
            <button onClick={() => handleAction(false)} style={styles.skipBtn}>SKIP (-1)</button>
          </div>
        </div>
      )}

      {gameState === 'REVIEW' && (
        <div style={styles.card}>
          <h2 style={{color: '#e74c3c'}}>VAQT TUGADI!</h2>
          <div style={styles.roundResult}>Bu raundda: {roundScore} ball</div>
          <button onClick={nextTurn} style={styles.mainButton}>KEYINGI JAMOA</button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '20px', backgroundColor: '#1a1a2e', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#fff' },
  header: { textAlign: 'center', marginBottom: '30px' },
  title: { letterSpacing: '3px', fontSize: '28px', color: '#00d2ff' },
  teamContainer: { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' },
  teamBadge: { backgroundColor: '#16213e', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', color: '#333', borderRadius: '25px', padding: '40px', textAlign: 'center', maxWidth: '400px', margin: '0 auto', boxShadow: '0 15px 35px rgba(0,0,0,0.3)' },
  turnTitle: { color: '#3498db', marginBottom: '10px' },
  langSelect: { marginBottom: '25px', padding: '8px', borderRadius: '5px', width: '100%' },
  mainButton: { width: '100%', padding: '15px', fontSize: '18px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' },
  word: { fontSize: '48px', fontWeight: 'bold', margin: '40px 0', textTransform: 'uppercase', color: '#2c3e50' },
  timerContainer: { width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden' },
  timerProgress: { height: '100%', backgroundColor: '#e67e22', transition: 'width 1s linear' },
  timerVal: { fontSize: '22px', fontWeight: 'bold', color: '#e67e22', marginTop: '5px' },
  btnRow: { display: 'flex', gap: '10px' },
  correctBtn: { flex: 2, padding: '18px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  skipBtn: { flex: 1, padding: '18px', backgroundColor: '#95a5a6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  roundResult: { fontSize: '24px', margin: '20px 0' }
};

export default App;