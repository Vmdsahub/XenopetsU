/**
 * SoundManager - Gerenciador de sons do jogo
 *
 * Este utilitário cuida de carregar, reproduzir e gerenciar efeitos sonoros e música
 * de fundo para o jogo, garantindo uma experiência de áudio consistente.
 */

// Mapa para armazenar os áudios pré-carregados
const audioCache: Record<string, HTMLAudioElement> = {};

// Check browser support for audio formats
const getNotificationSoundPath = (): string => {
  const audio = new Audio();

  // Check MP3 support
  if (audio.canPlayType("audio/mpeg")) {
    return "/sounds/notification-pop.mp3";
  }

  // If MP3 not supported, we'll handle it in the playSound function
  return "/sounds/notification-pop.mp3";
};

// Lista de sons disponíveis no jogo
export const Sounds = {
  NOTIFICATION: getNotificationSoundPath(),
  // Adicionar mais sons aqui conforme necessário
};

/**
 * Pré-carrega um som específico
 * @param soundPath Caminho para o arquivo de som
 * @returns Promise que resolve quando o som estiver carregado
 */
export const preloadSound = (soundPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (audioCache[soundPath]) {
        resolve(); // Já está carregado
        return;
      }

      const audio = new Audio();
      audio.src = soundPath;

      audio.addEventListener(
        "canplaythrough",
        () => {
          audioCache[soundPath] = audio;
          console.log(`Som carregado: ${soundPath}`);
          resolve();
        },
        { once: true },
      );

      audio.addEventListener("error", (e) => {
        const target = e.target as HTMLAudioElement;
        const errorDetails = {
          path: soundPath,
          error: e.type,
          message: "Audio load failed",
          readyState: target?.readyState,
          networkState: target?.networkState,
          errorCode: (target?.error as any)?.code,
          errorMessage: (target?.error as any)?.message,
          canPlayType: audio.canPlayType("audio/mpeg"),
          src: audio.src,
        };
        console.warn(
          `Som não pode ser carregado (não crítico): ${soundPath}`,
          errorDetails,
        );
        // Don't reject for non-critical sound loading failures
        resolve();
      });

      audio.load();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `Erro ao configurar pré-carregamento para ${soundPath}:`,
        errorMsg,
      );
      reject(new Error(`Sound setup failed: ${errorMsg}`));
    }
  });
};

/**
 * Pré-carrega todos os sons definidos no objeto Sounds
 */
export const preloadAllSounds = async (): Promise<void> => {
  console.log("Iniciando pré-carregamento de todos os sons...");

  try {
    const loadPromises = Object.values(Sounds).map((soundPath) =>
      preloadSound(soundPath).catch((error) => {
        console.warn(`Failed to preload ${soundPath}:`, error.message);
        return null; // Continue with other sounds even if one fails
      }),
    );
    await Promise.all(loadPromises);
    console.log("Pré-carregamento de sons concluído");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao pré-carregar sons:", errorMsg);
  }
};

/**
 * Reproduz um som específico
 * @param soundPath Caminho para o arquivo de som
 * @param volume Volume (0 a 1), padrão 0.5
 * @returns Promise que resolve quando o som começar a tocar ou rejeita em caso de erro
 */
export const playSound = (
  soundPath: string,
  volume: number = 0.5,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Tenta usar o som em cache primeiro
      if (audioCache[soundPath]) {
        // Cria um clone para permitir reproduções simultâneas
        const soundClone = audioCache[soundPath].cloneNode(
          true,
        ) as HTMLAudioElement;
        soundClone.volume = volume;

        const playPromise = soundClone.play();
        if (playPromise) {
          playPromise
            .then(() => resolve())
            .catch((error) => {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              console.error(
                `Erro ao reproduzir som do cache (${soundPath}):`,
                errorMsg,
              );
              tryAlternativePlay(soundPath, volume, resolve, reject);
            });
        } else {
          resolve();
        }
        return;
      }

      // Se não estiver em cache, tente reproduzir diretamente
      tryAlternativePlay(soundPath, volume, resolve, reject);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Erro ao reproduzir som ${soundPath}:`, errorMsg);
      reject(new Error(`Sound play failed: ${errorMsg}`));
    }
  });
};

/**
 * Tenta reproduzir um som usando método alternativo
 */
const tryAlternativePlay = (
  soundPath: string,
  volume: number,
  resolve: () => void,
  reject: (error: any) => void,
): void => {
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => resolve())
        .catch((error) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(`Erro ao reproduzir som ${soundPath}:`, errorMsg);
          reject(new Error(`Alternative sound play failed: ${errorMsg}`));
        });
    } else {
      resolve();
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Erro na reprodução alternativa ${soundPath}:`, errorMsg);
    reject(new Error(`Alternative sound setup failed: ${errorMsg}`));
  }
};

// Controle de frequência para sons de colisão
let lastCollisionSoundTime = 0;
const COLLISION_SOUND_COOLDOWN = 300; // 300ms entre sons de colisão

/**
 * Creates a clean, crisp collision sound using Web Audio API
 */
const playCollisionSound = (): Promise<void> => {
  return new Promise((resolve) => {
    const now = Date.now();

    // Controla frequência - só toca se passou tempo suficiente
    if (now - lastCollisionSoundTime < COLLISION_SOUND_COOLDOWN) {
      resolve();
      return;
    }

    lastCollisionSoundTime = now;

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create a simple but effective collision sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      // Connect the audio nodes
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure the filter for a cleaner sound
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, audioContext.currentTime);
      filter.Q.setValueAtTime(1, audioContext.currentTime);

      // Create a sharp, clean collision sound
      oscillator.type = "triangle"; // Smoother than sawtooth
      oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        100,
        audioContext.currentTime + 0.12,
      );

      // Clean volume envelope - reduzido para evitar sobreposição
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);

      setTimeout(() => resolve(), 150);
    } catch (error) {
      console.warn("Web Audio API collision sound failed:", error);
      resolve();
    }
  });
};

/**
 * Creates a notification sound using Web Audio API
 */
const playNotificationBeep = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a pleasant notification sound (two-tone beep)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.1,
        audioContext.currentTime + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      // Resolve after the sound finishes
      setTimeout(() => resolve(), 350);
    } catch (error) {
      console.warn("Web Audio API notification failed:", error);
      resolve(); // Don't fail - just continue silently
    }
  });
};

/**
 * Simplified Engine sound - creates new instances for 100% reliability
 */
let currentEngineSound: { stop: () => void } | null = null;

const createEngineSound = () => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    const startTime = audioContext.currentTime;

    // Cria múltiplos osciladores para som mais rico
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();

    const gain1 = audioContext.createGain();
    const gain2 = audioContext.createGain();
    const gain3 = audioContext.createGain();
    const masterGain = audioContext.createGain();

    // Conecta osciladores
    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);
    masterGain.connect(audioContext.destination);

    // Configuração para som de nave espacial futurística
    osc1.type = "sine";
    osc2.type = "sine";
    osc3.type = "triangle";

    // Frequências base e harmônicos
    osc1.frequency.setValueAtTime(120, startTime);
    osc2.frequency.setValueAtTime(240, startTime); // oitava
    osc3.frequency.setValueAtTime(180, startTime); // quinta

    // Modulação sutil para som vivo
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(3, startTime);
    lfoGain.gain.setValueAtTime(8, startTime);

    // Volumes individuais
    gain1.gain.setValueAtTime(0.04, startTime);
    gain2.gain.setValueAtTime(0.02, startTime);
    gain3.gain.setValueAtTime(0.015, startTime);

    // Envelope de volume master com fade-in rápido
    masterGain.gain.setValueAtTime(0, startTime);
    masterGain.gain.linearRampToValueAtTime(1, startTime + 0.1);

    // Inicia osciladores
    const oscillators = [osc1, osc2, osc3, lfo];
    oscillators.forEach((osc) => osc.start(startTime));

    // Retorna controle para parar
    return {
      stop: () => {
        try {
          const stopTime = audioContext.currentTime;
          masterGain.gain.linearRampToValueAtTime(0, stopTime + 0.1);

          setTimeout(() => {
            oscillators.forEach((osc) => {
              try {
                osc.stop();
              } catch (e) {
                // Ignora erros
              }
            });
            audioContext.close();
          }, 150);
        } catch (error) {
          console.warn("Engine sound stop failed:", error);
        }
      },
    };
  } catch (error) {
    console.warn("Engine sound creation failed:", error);
    return { stop: () => {} };
  }
};

// Funções de conveniência
export const playNotificationSound = (): Promise<void> => {
  // Tenta o Web Audio API primeiro (mais confiável)
  return playNotificationBeep().catch(() => {
    // Fallback para arquivo MP3
    return playSound(Sounds.NOTIFICATION, 0.5).catch((error) => {
      console.warn("Both notification methods failed:", error.message);
      // Não lança erro para sons de notificação - eles não são críticos
    });
  });
};

export const startEngineSound = (): void => {
  // Para o som anterior se existir
  if (currentEngineSound) {
    currentEngineSound.stop();
  }

  // Cria e inicia novo som imediatamente
  currentEngineSound = createEngineSound();
};

export const stopEngineSound = (): void => {
  if (currentEngineSound) {
    currentEngineSound.stop();
    currentEngineSound = null;
  }
};

export const playBarrierCollisionSound = (): Promise<void> => {
  return playCollisionSound().catch((error) => {
    console.warn("Collision sound failed:", error.message);
  });
};
