import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { wordBank } from './words';
import type { GameState, Word, Team } from './types';
import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capacitor-community/native-audio';

// Internal Types
interface RoundAttempt {
  word: Word;
  isCorrect: boolean;
}

const teamNamesUz = ["Chumoli xo'r Sherlar", "G'ilay Burgutlar", "Safsataboz Lochinlar", 
                    "Yovuz Quyonchalar", "Otqochar Chavandozlar","Parhez-Parast Pandalar",
                    "Poygachi Shilliqqurtlar", "Qonxo'r Qo'ylar", "Dangasa Gepardlar", 
                    "Tishsiz Bo'rilar", "Uyquchi Qoplonlar", "Parhezchi Begimotlar", 
                  "Kamgap To'tiqushlar", "Semiz Chigirtkalar", "Zamonaviy Echkilar"];
const teamNamesEn = [ 
        "Iron Lions",
        "Golden Eagles",
        "Silver Wolves",
        "Shadow Ninjas",
        "Crimson Falcons",
        "Ancient Warriors",
        "Thunder Titans",
        "Desert Phantoms",
        "Storm Riders",
        "Midnight Panthers",
        "Wild Mustangs",
        "Arctic Foxes",
        "Royal Knights",
        "Apex Predators",
        "Valiant Vikings"
      ];
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
    // This kills the white border at the root level
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        html, body {
          background-color: #0f172a !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          -webkit-user-select: none; /* Prevents text selection ghosting */
        }
        #root {
          background-color: #0f172a !important;
          height: 100%;
        }
      `;
      document.head.appendChild(style);
    }
  // Game Configuration
  const [gameState, setGameState] = useState<GameState | 'LANG_SELECT' | 'SETTINGS' | 'AWAIT_REVIEW'>('LANG_SELECT');
  const [language, setLanguage] = useState<'uz' | 'en'>('uz');
  const [hasSkipPenalty, setHasSkipPenalty] = useState(true);
  const [roundDuration, setRoundDuration] = useState(30);
  const [winningScore, setWinningScore] = useState(50);

  // Game Logic State
  const [teams, setTeams] = useState<Team[]>([{ name: '1-Jamoa', score: 0 }, { name: '2-Jamoa', score: 0 }]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const timeLeftRef = useRef(timeLeft);
  
  // OPTIMIZATION: Use a shuffled deck instead of filtering used IDs every turn
  const [wordDeck, setWordDeck] = useState<Word[]>([]);
  const [roundHistory, setRoundHistory] = useState<RoundAttempt[]>([]);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [team1HasPlayedFinal, setTeam1HasPlayedFinal] = useState(false);
  const [suddenRounds, setSuddenRounds] = useState<[number, number]>([0, 0]);
  // If a team reaches the winning score, this holds the index of the team
  // that must be given the final chance (other team). null means none pending.
  const [finalChancePending, setFinalChancePending] = useState<number | null>(null);
  // null = not awarded yet, -1 = no one, 0/1 = team index awarded
  const [lastWordAwarded, setLastWordAwarded] = useState<number | null>(null);
  console.log(wordDeck,team1HasPlayedFinal,suddenRounds);

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
    setIsSuddenDeath(false);
    setTeam1HasPlayedFinal(false);
    setSuddenRounds([0, 0]);
    setLastWordAwarded(null);
    setFinalChancePending(null);
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

// HOOK 1: Preloading (Only runs once when the app opens)
useEffect(() => {
  const initAudio = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAudio.preload({
          assetId: 'correct',
          assetPath: 'public/correct.mp3', 
          audioChannelNum: 1
        });
        await NativeAudio.preload({
          assetId: 'skip',
          assetPath: 'public/skip.mp3',
          audioChannelNum: 1
        });
        // Add the tick sound here
        await NativeAudio.preload({
          assetId: 'tick',
          assetPath: 'public/tick.mp3', 
          audioChannelNum: 1
        });
      } catch (e) {
        console.error('Native Audio Preload Failed:', e);
      }
    }
  };
  initAudio();
}, []);


// This keeps the Ref in sync with the State
useEffect(() => { 
  timeLeftRef.current = timeLeft; 
}, [timeLeft]);

useEffect(() => {
  let interval: number | undefined;

  if (gameState === 'PLAYING') {
    interval = window.setInterval(() => {
      const currentTime = timeLeftRef.current;

      if (currentTime <= 0) {
        clearInterval(interval);
        // Stop the sound if it's still playing when time hits 0
        if (Capacitor.isNativePlatform()) {
          NativeAudio.stop({ assetId: 'tick' }).catch(() => {});
        }
        setGameState('AWAIT_REVIEW');
        setLastWordAwarded(null);
        return;
      }

      const nextTime = currentTime - 1;

      // FIX: Trigger the sound ONLY ONCE at exactly 8 seconds
      if (nextTime === 8) {
        if (Capacitor.isNativePlatform()) {
          NativeAudio.play({ assetId: 'tick' }).catch(() => {});
        } else {
          // Localhost: we store the audio in a variable to stop it later if needed
          const audio = new Audio('/tick.mp3');
          audio.id = 'active-tick-sound';
          audio.play().catch(() => {});
        }
      }

      setTimeLeft(nextTime);
    }, 1000);
  }

  return () => {
    if (interval) {
      clearInterval(interval);
      // Safety: Stop the sound if the user exits the game or switches screens
      if (Capacitor.isNativePlatform()) {
        NativeAudio.stop({ assetId: 'tick' }).catch(() => {});
      }
    }
  };
}, [gameState]);

//Action Functions
const startRound = () => {
    setRoundHistory([]);
    setTimeLeft(roundDuration);
    setLastWordAwarded(null);
    getNextWord(); 
    setGameState('PLAYING');
  };

// 3. Updated Action Logic for instant sounds
const handleAction = (isCorrect: boolean) => {
  const assetId = isCorrect ? 'correct' : 'skip';
  const fileName = isCorrect ? 'correct.mp3' : 'skip.mp3';

  if (Capacitor.isNativePlatform()) {
    // High-performance sound for iPhone
    NativeAudio.play({ assetId });
  } else {
    // Standard web sound for Localhost testing
    const audio = new Audio(`/${fileName}`);
    audio.play().catch(e => console.log("Web audio wait for click:", e));
  }

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
    let roundPoints = roundHistory.reduce((acc, curr) => {
      if (curr.isCorrect) return acc + 1;
      return hasSkipPenalty ? acc - 1 : acc;
    }, 0);

    const updatedTeams = [...teams];
    const otherTeamIndex = currentTeamIndex === 0 ? 1 : 0;

    // Apply award selection (lastWordAwarded) now — editable until finalize
    if (lastWordAwarded === currentTeamIndex) {
      roundPoints += 1;
    } else if (lastWordAwarded === otherTeamIndex) {
      updatedTeams[otherTeamIndex].score += 1;
    }

    updatedTeams[currentTeamIndex].score += roundPoints;
    setTeams(updatedTeams);

    const team1Score = updatedTeams[0].score;
    const team2Score = updatedTeams[1].score;

    // SUDDEN DEATH MODE: Both teams keep playing alternately until one has more points
    // clear award selection for next round
    setLastWordAwarded(null);

    if (isSuddenDeath) {
      // Increment sudden round counter for the current team, then decide
      setSuddenRounds(prev => {
        const next: [number, number] = [prev[0], prev[1]];
        next[currentTeamIndex] = prev[currentTeamIndex] + 1;

        // If both teams have played the same number of sudden rounds, compare scores
        if (next[0] === next[1]) {
          if (team1Score > team2Score) {
            setGameState('GAME_OVER');
          } else if (team2Score > team1Score) {
            setGameState('GAME_OVER');
          } else {
            // Still tied, start next sudden-death round beginning with team 0
            setCurrentTeamIndex(0);
            setGameState('START');
          }
        } else {
          // Other team gets their turn
          setCurrentTeamIndex(otherTeamIndex);
          setGameState('START');
        }

        return next;
      });
    } else {
      // NORMAL MODE: simplified final-chance flow
      const currentTeamReachedGoal = updatedTeams[currentTeamIndex].score >= winningScore;
      const otherTeamReachedGoal = updatedTeams[otherTeamIndex].score >= winningScore;

      // If there's a pending final chance for the other team, handle it first
      if (finalChancePending !== null) {
        // If current team is the one who had the pending final chance, resolve
        if (currentTeamIndex === finalChancePending) {
          setFinalChancePending(null);
          if (team1Score > team2Score) {
            setCurrentTeamIndex(0);
            setGameState('GAME_OVER');
          } else if (team2Score > team1Score) {
            setCurrentTeamIndex(1);
            setGameState('GAME_OVER');
          } else {
            // Tie -> sudden death
            setIsSuddenDeath(true);
            setSuddenRounds([0, 0]);
            setCurrentTeamIndex(0);
            setGameState('START');
          }
        } else {
          // Give the pending team their turn
          setCurrentTeamIndex(finalChancePending);
          setGameState('START');
        }

        return;
      }

      // If current team just reached the goal and other hasn't, grant other team a final chance
      if (currentTeamReachedGoal && !otherTeamReachedGoal) {
        setFinalChancePending(otherTeamIndex);
        // keep legacy flag for compatibility
        if (otherTeamIndex === 1) setTeam1HasPlayedFinal(true);
        setCurrentTeamIndex(otherTeamIndex);
        setGameState('START');
        return;
      }

      // If both already reached goal, decide immediately or sudden-death on tie
      if (currentTeamReachedGoal && otherTeamReachedGoal) {
        if (team1Score > team2Score) {
          setCurrentTeamIndex(0);
          setGameState('GAME_OVER');
        } else if (team2Score > team1Score) {
          setCurrentTeamIndex(1);
          setGameState('GAME_OVER');
        } else {
          setIsSuddenDeath(true);
          setSuddenRounds([0, 0]);
          setCurrentTeamIndex(0);
          setGameState('START');
        }

        return;
      }

      // Normal switch: neither reached the goal yet
      setCurrentTeamIndex(otherTeamIndex);
      setGameState('START');
    }
  };

  const awardPoint = (teamIndex: number) => {
    // allow editing until finalizeRound; teamIndex === -1 means 'no one'
    if (!currentWord) return;
    setLastWordAwarded(teamIndex);
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
            <button style={styles.mainButton} onClick={() => setGameState('START')}>
              {language === 'uz' ? "DAVOM ETISH" : "CONTINUE"}
            </button>
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
          <button onClick={startRound} style={styles.bottomButton}>
            {language === 'uz' ? "BOSHLASH" : "START"}
          </button>
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
            <button onClick={() => handleAction(true)} style={styles.correctBtn}>
              {language === 'uz' ? "TO'G'RI" : "CORRECT"}
            </button>
            <button onClick={() => handleAction(false)} style={styles.skipBtn}>
              {language === 'uz' ? "O'TKAZIB YUBORISH" : "SKIP"}
            </button>
          </div>
        </div>
      )}

      {/* 4.5 WAIT FOR USER TO CONFIRM LAST WORD BEFORE REVIEW */}
      {gameState === 'AWAIT_REVIEW' && (
      <div style={styles.gameContent}>
        <div style={styles.playHeader}>
          <div style={{ color: '#fb7185' }}>0s</div>
          <div>
            {language === 'uz' ? 'Ball' : 'Score'}: {currentRoundScore}
          </div>
        </div>

        <div style={styles.wordArea}>
          <h1 style={styles.wordText}>{currentWord?.text}</h1>
        </div>

        <div style={styles.actionArea}>
          {/* 1. Dynamic Question/Confirmation Area */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            {lastWordAwarded === null ? (
              <p style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {language === 'uz' ? "Bu so'zni kim topdi?" : "Who found the word?"}
              </p>
            ) : (
              <p style={{ color: '#10b981', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {language === 'uz' 
                  ? `${teams[lastWordAwarded].name} topishdi +1 ball` 
                  : `${teams[lastWordAwarded].name} found it! +1 point`}
              </p>
            )}
          </div>

          {/* 2. Team Selection Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'stretch' }}>
            {[0, 1].map((index) => (
              <button
                key={index}
                onClick={() => awardPoint(index)}
                style={{
                  ...styles.awardBtn,
                  flex: 1,
                  // UI Fixes for long names:
                  minHeight: '60px', // Minimum height, but can grow if needed
                  height: 'auto',      // Allows vertical expansion
                  padding: '8px 4px', // Space for multi-line text
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  wordBreak: 'break-word', // Forces long words to wrap
                  fontSize: '14px',        // Slightly smaller font to fit more
                  lineHeight: '1.2',
                  
                  // Your existing dynamic styles:
                  backgroundColor: lastWordAwarded === index ? '#10b981' : 'transparent',
                  border: lastWordAwarded === index ? '3px solid #059669' : '2px solid #38bdf8',
                  color: lastWordAwarded === index ? '#fff' : '#38bdf8',
                }}
              >
                {teams[index].name}
              </button>
            ))}
          </div>

          {/* 3. Main Action Button */}
          <button 
            onClick={() => setGameState('REVIEW')} 
            style={{ ...styles.bottomButton, width: '100%' }}
          >
            {language === 'uz' ? 'NATIJALARNI TEKSHIRISH' : 'CHECK RESULTS'}
          </button>
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
          <button onClick={finalizeRound} style={styles.bottomButton}>
            {language === 'uz' ? "TASDIQLASH" : "CONFIRM"}
          </button>
        </div>
      )}

      {/* 6. GAME OVER */}
      {gameState === 'GAME_OVER' && (
        <div style={styles.fullScreenCenter}>
          <div style={{fontSize: '60px', marginBottom: '20px', animation: 'bounce 1s infinite'}}>
            🎉 🏆 🎉
          </div>
          <h1 style={styles.brandTitle}>G'ALABA!</h1>
          <h2 style={{fontSize: '32px', marginBottom: '30px'}}>{teams[currentTeamIndex].name} g'olib bo'ldi! 👑</h2>
          <div style={{fontSize: '48px', marginBottom: '30px'}}>
            ✨ 🎊 ✨
          </div>
          <button onClick={() => setGameState('LANG_SELECT')} style={styles.mainButton}>MENU</button>
        </div>
      )}
    </div>
  );
}

// Add keyframe animation for celebration
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);

// Styles object remains largely the same but ensured for responsiveness
const styles: Record<string, React.CSSProperties> = {
// 1. Force the container to be the exact height of the screen
    container: { 
    backgroundColor: '#0f172a', 
    color: '#f8fafc', 
    height: '100dvh', // Use dynamic viewport height
    width: '100vw',
    fontFamily: 'sans-serif', 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden', // Keeps the "white border" fix working
    position: 'fixed',   // Prevents the whole page from bouncing
    top: 0,
    left: 0
  },
  fullScreenCenter: { 
    flex: 1, 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: '40px', 
    textAlign: 'center' 
  },
  brandTitle: { 
    fontSize: '72px', 
    fontWeight: '900', 
    color: '#38bdf8', 
    marginBottom: '20px' 
  },
  // FIXED: Standardizes the main buttons (Boshlash, Natijani Tekshirish)
    mainButton: { 
    width: '90%',           // Consistent width
    alignSelf: 'center',    // Centers the button
    padding: '20px', 
    borderRadius: '24px',   // Large rounded corners
    border: 'none', 
    backgroundColor: '#38bdf8', 
    color: '#0f172a', 
    fontWeight: 'bold', 
    fontSize: '20px', 
    cursor: 'pointer',
    marginBottom: '15px' 
  },
  settingsBox: { 
    width: '100%', 
    maxWidth: '400px', 
    backgroundColor: '#1e293b', 
    padding: '20px', 
    borderRadius: '16px', 
    marginBottom: '40px' 
  },
  settingRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    margin: '15px 0', 
    fontSize: '18px' 
  },
  flexCenter: { 
    display: 'flex', 
    alignItems: 'center' 
  },
  circleBtn: { 
    width: '36px', 
    height: '36px', 
    borderRadius: '50%', 
    border: 'none', 
    backgroundColor: '#38bdf8', 
    fontWeight: 'bold', 
    fontSize: '20px', 
    cursor: 'pointer' 
  },
  checkbox: { 
    width: '24px', 
    height: '24px' 
  },
  // 2. This wrapper must take up all available space
  gameContent: { 
    flex: 1, 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%',
    width: '100%',
    overflow: 'hidden' // Important: ensures only the list scrolls, not the header/footer
  },
  // FIXED: Ensures team scores don't overlap with the notch
  scoreRow: { 
    display: 'flex', 
    justifyContent: 'space-around', 
    padding: '20px', 
    paddingTop: 'calc(env(safe-area-inset-top) + 10px)', 
    fontSize: '18px' 
  },
  activeT: { 
    color: '#38bdf8', 
    borderBottom: '2px solid #38bdf8', 
    fontWeight: 'bold' 
  },
  centerBox: { 
    flex: 1, 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  hugeText: { 
    fontSize: '60px', 
    color: '#38bdf8', 
    margin: 0, 
    textAlign: 'center' 
  },
  // FIXED: Makes BOSHLASH / NATIJANI TEKSHIRISH float and round on ALL corners
    bottomButton: { 
    width: '90%',           // Prevents it from being "huge" across the whole screen
    alignSelf: 'center',    // Centers it
    padding: '20px',        // Comfortable vertical padding
    borderRadius: '20px',   // Rounds all 4 corners
    backgroundColor: '#38bdf8', 
    color: '#0f172a', 
    border: 'none', 
    fontWeight: 'bold', 
    fontSize: '20px', 
    cursor: 'pointer',
    /* The Magic Part: Lift it away from the bottom bar */
    marginBottom: 'calc(env(safe-area-inset-bottom) + 30px)', 
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' // Optional: adds a slight lift effect
  },
  awardBtn: { 
    padding: '18px', 
    borderRadius: '12px', 
    backgroundColor: '#38bdf8', 
    color: '#0f172a', 
    fontWeight: 'bold', 
    fontSize: '18px', 
    cursor: 'pointer', 
    border: '3px solid transparent' 
  },
  // FIXED: Pushes Timer and "Ball" display safely away from top icons
  playHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    padding: '20px', 
    paddingTop: 'calc(env(safe-area-inset-top) + 15px)',
    fontSize: '28px', 
    fontWeight: 'bold' 
  },
  timerBar: { 
    height: '8px', 
    backgroundColor: '#1e293b', 
    margin: '0 20px', 
    borderRadius: '4px', 
    overflow: 'hidden' 
  },
  timerProgress: { 
    height: '100%', 
    backgroundColor: '#38bdf8', 
    transition: 'width 1s linear' 
  },
  wordArea: { 
    flex: 1, 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: '0 20px',
    marginTop: '-30px' 
  },
  wordText: { 
    fontSize: 'clamp(32px, 12vw, 64px)', 
    fontWeight: 'bold', 
    textAlign: 'center', 
    textTransform: 'uppercase' 
  },
  // FIXED: Positions game buttons safely above the Home Indicator bar
  // FIXED: Standardizes the "To'g'ri" and "Skip" buttons to be identical
  // FIXED: Standardizes the "TO'G'RI" and "SKIP" buttons to be identical in width
    actionArea: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center',   // Centers the buttons
    gap: '12px', 
    padding: '20px',
    /* Pushes the game buttons up from the home bar */
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' 
  },
    correctBtn: { 
    width: '100%',           // Fills 100% of the actionArea (which is 90% of screen)
    maxWidth: '400px',      // Prevents it from getting too wide on iPads
    padding: '25px', 
    borderRadius: '20px',   // Rounded corners
    backgroundColor: '#22c55e', 
    border: 'none', 
    color: '#fff', 
    fontSize: '24px', 
    fontWeight: 'bold', 
    cursor: 'pointer' 
  },
    skipBtn: { 
    width: '100%',           // Matches Correct button width
    maxWidth: '400px',
    padding: '18px', 
    borderRadius: '20px',   // Rounded corners
    backgroundColor: '#475569', 
    border: 'none', 
    color: '#fff', 
    fontSize: '18px', 
    cursor: 'pointer' 
  },
  // FIXED: The actual list of words needs "auto" scrolling and touch support
  // 3. THE FIX: The list must have a specific height constraint to scroll
  reviewList: { 
    flex: 1, 
    overflowY: 'auto',                // Enables vertical scroll
    WebkitOverflowScrolling: 'touch', // Native iOS momentum scroll
    padding: '10px 20px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '8px',
    /* This is the secret: It tells the list it can't be taller than 
       the space between the header and the bottom button.
    */
    maxHeight: '60vh', 
    marginTop: '10px',
    marginBottom: '10px'
  },
  reviewItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    padding: '15px 20px', 
    borderRadius: '12px', 
    fontSize: '20px', 
    fontWeight: 'bold', 
    cursor: 'pointer' 
  },
  title: { 
    marginBottom: '20px', 
    color: '#38bdf8' 
  }
};

export default App;