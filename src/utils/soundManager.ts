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
 * Enhanced Engine sound manager for ship motors
 */
class EngineSound {
  private audioContext: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private startTime = 0;
  private lastStartTime = 0;
  private startDebounceTimeout: NodeJS.Timeout | null = null;

  // Constantes para controle de frequência
  private readonly MIN_PLAY_DURATION_MS = 100; // Duração mínima antes de parar

  start(): void {
    // Se já está tocando, não inicia novamente
    if (this.isPlaying) {
      // Cancela qualquer timeout de parada pendente
      if (this.startDebounceTimeout) {
        clearTimeout(this.startDebounceTimeout);
        this.startDebounceTimeout = null;
      }
      return;
    }

    this.lastStartTime = Date.now();

    // Cancela qualquer timeout anterior
    if (this.startDebounceTimeout) {
      clearTimeout(this.startDebounceTimeout);
    }

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      this.startTime = this.audioContext.currentTime;

      // Cria múltiplos osciladores para som mais rico
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const osc3 = this.audioContext.createOscillator();

      const gain1 = this.audioContext.createGain();
      const gain2 = this.audioContext.createGain();
      const gain3 = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();

      // Conecta osciladores
      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);

      gain1.connect(masterGain);
      gain2.connect(masterGain);
      gain3.connect(masterGain);
      masterGain.connect(this.audioContext.destination);

      // Configuração para som de nave espacial futurística
      osc1.type = "sine";
      osc2.type = "sine";
      osc3.type = "triangle";

      // Frequências base e harmônicos
      osc1.frequency.setValueAtTime(120, this.startTime);
      osc2.frequency.setValueAtTime(240, this.startTime); // oitava
      osc3.frequency.setValueAtTime(180, this.startTime); // quinta

      // Modulação sutil para som vivo
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      lfo.type = "sine";
      lfo.frequency.setValueAtTime(3, this.startTime);
      lfoGain.gain.setValueAtTime(8, this.startTime);

      // Volumes individuais
      gain1.gain.setValueAtTime(0.04, this.startTime);
      gain2.gain.setValueAtTime(0.02, this.startTime);
      gain3.gain.setValueAtTime(0.015, this.startTime);

      // Envelope de volume master com fade-in suave
      masterGain.gain.setValueAtTime(0, this.startTime);
      masterGain.gain.linearRampToValueAtTime(1, this.startTime + 0.15);

      // Inicia osciladores
      osc1.start(this.startTime);
      osc2.start(this.startTime);
      osc3.start(this.startTime);
      lfo.start(this.startTime);

      // Armazena referências para cleanup
      this.oscillators = [osc1, osc2, osc3, lfo];
      this.gainNodes = [gain1, gain2, gain3, lfoGain];
      this.masterGain = masterGain;
      this.isPlaying = true;
    } catch (error) {
      console.warn("Engine sound failed to start:", error);
      this.isPlaying = false;
    }
  }

  stop(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    try {
      const stopTime = this.audioContext.currentTime;

      // Fade out mais rápido
      this.masterGain.gain.linearRampToValueAtTime(0, stopTime + 0.1);

      // Para todos os osciladores após o fade
      setTimeout(() => {
        this.oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch (e) {
            // Ignora erros se já parou
          }
        });

        if (this.audioContext) {
          this.audioContext.close();
        }

        // Limpa referências
        this.oscillators = [];
        this.gainNodes = [];
        this.masterGain = null;
        this.audioContext = null;
        this.isPlaying = false;

        // Reseta o timer de debounce para permitir start imediato após parar
        this.lastStartTime = 0;
      }, 150);
    } catch (error) {
      console.warn("Engine sound failed to stop:", error);
      this.isPlaying = false;
    }
  }

  // Método para verificar se está tocando
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}

// Instância global do som do motor
const engineSound = new EngineSound();

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
  // Só inicia se não estiver já tocando
  if (!engineSound.isCurrentlyPlaying()) {
    engineSound.start();
  }
};

export const stopEngineSound = (): void => {
  engineSound.stop();
};

export const playBarrierCollisionSound = (): Promise<void> => {
  return playCollisionSound().catch((error) => {
    console.warn("Collision sound failed:", error.message);
  });
};
