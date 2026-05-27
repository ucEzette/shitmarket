'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.isMuted = m;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * Universal Helper to synthesize speech vowels using parallel Formant (Bandpass) Filters.
   * This simulates the resonance of the human vocal tract.
   * Standard Formant Vowel frequencies (F1, F2, F3):
   *   "AH" -> F1: 730Hz,  F2: 1090Hz, F3: 2440Hz
   *   "OH" -> F1: 570Hz,  F2: 840Hz,  F3: 2410Hz
   *   "UH" -> F1: 520Hz,  F2: 1190Hz, F3: 2390Hz
   *   "EE" -> F1: 270Hz,  F2: 2290Hz, F3: 3010Hz
   *   "EH" -> F1: 530Hz,  F2: 1840Hz, F3: 2480Hz
   */
  private playFormantSpeech(
    startPitch: number,
    endPitch: number,
    duration: number,
    formants: { f1: number; f2: number; f3: number },
    options: {
      vibrato?: boolean;
      raspy?: boolean;
      nasal?: boolean;
      shStart?: boolean;
      tEnd?: boolean;
      volumeMultiplier?: number;
      trollLaugh?: boolean;
    } = {}
  ) {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const vol = (options.volumeMultiplier ?? 1.0) * 0.48; // Boosted volume for maximum audibility

      // 1. Core Source: Combo of Sawtooth and Square wave for a clear, crisp, bright troll/cartoon sound
      const oscSaw = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      
      oscSaw.type = "sawtooth";
      oscTri.type = "square"; // Square waves add distinct vowel clarity and cartoon flavor

      oscSaw.frequency.setValueAtTime(startPitch, now);
      oscSaw.frequency.exponentialRampToValueAtTime(endPitch, now + duration);
      
      oscTri.frequency.setValueAtTime(startPitch * 1.02, now); // slightly detuned for chorus thickness
      oscTri.frequency.exponentialRampToValueAtTime(endPitch * 1.02, now + duration);

      // Low frequency pitch vibrato for standard vocal expression
      if (options.vibrato && !options.trollLaugh) {
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(7.5, now); // ~7.5 Hz vibrato
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(12, now); // Bolder pitch wobble depth
        lfo.connect(lfoGain);
        lfoGain.connect(oscSaw.frequency);
        lfoGain.connect(oscTri.frequency);
        lfo.start(now);
        lfo.stop(now + duration);
      }

      // HILARIOUS TROLL LAUGH EFFECT: rapid chuckling pitch and volume wobbler
      if (options.trollLaugh) {
        // Laugh LFO modulates pitch at ~9.5 Hz (chuckle rate) with rapid sawtooth waves
        const laughLFO = ctx.createOscillator();
        laughLFO.type = "sawtooth";
        laughLFO.frequency.setValueAtTime(9.5, now);
        
        const laughGain = ctx.createGain();
        laughGain.gain.setValueAtTime(35, now); // Pronounced pitch wobble
        
        laughLFO.connect(laughGain);
        laughGain.connect(oscSaw.frequency);
        laughGain.connect(oscTri.frequency);
        
        laughLFO.start(now);
        laughLFO.stop(now + duration);
      }

      // Base bandpass filter to clip extreme highs
      const voiceFilter = ctx.createBiquadFilter();
      voiceFilter.type = "bandpass";
      voiceFilter.frequency.setValueAtTime(650, now); // Shifted up for clearer tones
      voiceFilter.Q.setValueAtTime(0.8, now);

      // Nasal sound adds a sub-harmonic buzz
      if (options.nasal) {
        const subBuzz = ctx.createOscillator();
        subBuzz.type = "triangle";
        subBuzz.frequency.setValueAtTime(startPitch * 1.5, now);
        subBuzz.frequency.exponentialRampToValueAtTime(endPitch * 1.5, now + duration);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.12, now);
        subBuzz.connect(subGain);
        subGain.connect(voiceFilter);
        subBuzz.start(now);
        subBuzz.stop(now + duration);
      }

      // 2. Main Gain for fading voice in and out nicely
      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0.001, now);
      mainGain.gain.linearRampToValueAtTime(vol, now + 0.06); // faster fade-in
      mainGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Connect Amplitude Modulator to mainGain for laughing giggles
      if (options.trollLaugh) {
        const ampLfo = ctx.createOscillator();
        ampLfo.type = "sine";
        ampLfo.frequency.setValueAtTime(9.5, now);
        
        const ampGain = ctx.createGain();
        ampGain.gain.setValueAtTime(vol * 0.45, now); // wobbles the volume up and down
        
        ampLfo.connect(ampGain);
        ampGain.connect(mainGain.gain);
        
        ampLfo.start(now);
        ampLfo.stop(now + duration);
      }

      // 3. Three parallel Formant Bandpass Filters representing F1, F2, F3
      const f1node = ctx.createBiquadFilter();
      const f2node = ctx.createBiquadFilter();
      const f3node = ctx.createBiquadFilter();

      f1node.type = "bandpass";
      f2node.type = "bandpass";
      f3node.type = "bandpass";

      // Vowel Frequencies
      f1node.frequency.setValueAtTime(formants.f1, now);
      f2node.frequency.setValueAtTime(formants.f2, now);
      f3node.frequency.setValueAtTime(formants.f3, now);

      // Sizing the Bandpass width (Q-factor - higher is narrower/more metallic)
      const qVal = options.raspy ? 14 : 10;
      f1node.Q.setValueAtTime(qVal, now);
      f2node.Q.setValueAtTime(qVal, now);
      f3node.Q.setValueAtTime(qVal, now);

      // Relative amplitude of the formants
      const f1Gain = ctx.createGain();
      const f2Gain = ctx.createGain();
      const f3Gain = ctx.createGain();

      f1Gain.gain.setValueAtTime(1.0, now);
      f2Gain.gain.setValueAtTime(0.65, now); // boosted F2 for high clarity
      f3Gain.gain.setValueAtTime(0.42, now); // boosted F3 for high clarity

      // Connections for speech oscillators
      oscSaw.connect(voiceFilter);
      oscTri.connect(voiceFilter);

      // Connect source to parallel filters
      voiceFilter.connect(f1node);
      voiceFilter.connect(f2node);
      voiceFilter.connect(f3node);

      // Parallel recombine
      f1node.connect(f1Gain);
      f2node.connect(f2Gain);
      f3node.connect(f3Gain);

      f1Gain.connect(mainGain);
      f2Gain.connect(mainGain);
      f3Gain.connect(mainGain);

      mainGain.connect(ctx.destination);

      // Start the voice oscillators
      oscSaw.start(now);
      oscSaw.stop(now + duration);
      oscTri.start(now);
      oscTri.stop(now + duration);

      // Optional "SH" consonant noise at the start (common for "sheesh" or "shitmarket")
      if (options.shStart) {
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const shNoise = ctx.createBufferSource();
        shNoise.buffer = buffer;

        const shFilter = ctx.createBiquadFilter();
        shFilter.type = "highpass";
        shFilter.frequency.setValueAtTime(3200, now);

        const shGain = ctx.createGain();
        shGain.gain.setValueAtTime(0.12, now);
        shGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        shNoise.connect(shFilter);
        shFilter.connect(shGain);
        shGain.connect(ctx.destination);

        shNoise.start(now);
        shNoise.stop(now + 0.15);
      }

      // Optional "T" or click consonant at the end (e.g., getting rekt cutoff)
      if (options.tEnd) {
        const clickNoise = ctx.createOscillator();
        clickNoise.type = "triangle";
        clickNoise.frequency.setValueAtTime(4500, now + duration - 0.04);
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.001, now);
        clickGain.gain.setValueAtTime(0.15, now + duration - 0.04);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        clickNoise.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickNoise.start(now);
        clickNoise.stop(now + duration);
      }

    } catch (e) {
      console.error(e);
    }
  }

  /* ========================================================================
     Vocal Phonovox Expressions (Stylized with clear, highly audible troll/laugh tones)
     ======================================================================== */

  /**
   * Spoken Vowel Accent: "BRUHHH!"
   * Rich, highly audible, funny, mockingly deep cartoon vibrato slide.
   * Vowel used: "UH" (F1: 520, F2: 1190, F3: 2390)
   */
  speakBruh() {
    // 175Hz down to 135Hz - high clarity, bright voice pitch
    this.playFormantSpeech(175, 135, 0.72, {
      f1: 520,
      f2: 1190,
      f3: 2390,
    }, {
      vibrato: true,
      nasal: true,
      volumeMultiplier: 1.6,
      trollLaugh: true // adds laughing chuckle!
    });
  }

  /**
   * Spoken Vowel Accent: "SHEEEESH!!"
   * High-energy, long vocal tone, extremely animated, squeaky cartoon laugh.
   * Begins with an airy "SH" noise, then transitions into a resonating "EE" vowel.
   */
  speakSheeeesh() {
    this.playFormantSpeech(320, 350, 1.15, {
      f1: 270,
      f2: 2290,
      f3: 3010
    }, {
      vibrato: true,
      shStart: true,
      volumeMultiplier: 1.5,
      trollLaugh: true // giggles on the sheesh!
    });
  }

  /**
   * Spoken Vowel Accent: "AW NAW!" (Representing "Aw Naw, My Boy!")
   * Two rapid consecutive highly mock giggly segments.
   * Segment 1: "AH" sliding down.
   * Segment 2: "OH" sliding down.
   */
  speakNaw() {
    if (this.isMuted) return;
    try {
      const now = this.initCtx().currentTime;
      // "AH"
      this.playFormantSpeech(210, 180, 0.38, { f1: 730, f2: 1090, f3: 2440 }, { nasal: true, trollLaugh: true, volumeMultiplier: 1.3 });
      
      // Delay second word "OH"
      setTimeout(() => {
        this.playFormantSpeech(176, 134, 0.52, { f1: 570, f2: 840, f3: 2410 }, { vibrato: true, nasal: true, trollLaugh: true, volumeMultiplier: 1.3 });
      }, 360);
    } catch (e) {
       console.error(e);
    }
  }

  /**
   * Spoken Vowel Accent: "WHAT?!" (Highly squeaky, laughy cartoon surprise rise at end)
   * Vowel used: "UH" -> slides up in frequency at the end with a sharp "T" cutoff.
   */
  speakWhat() {
    this.playFormantSpeech(220, 310, 0.38, {
      f1: 520,
      f2: 1250,
      f3: 2400
    }, {
      raspy: true,
      tEnd: true,
      volumeMultiplier: 1.5,
      trollLaugh: true
    });
  }

  /**
   * Spoken Vowel Accent: "NO RUG!"
   * Segment 1: Confident mock giggly "NO"
   * Segment 2: Deep laughy "RUG"
   */
  speakNoRug() {
    if (this.isMuted) return;
    try {
      this.playFormantSpeech(230, 190, 0.32, { f1: 570, f2: 840, f3: 2410 }, { trollLaugh: true, volumeMultiplier: 1.3 });
      setTimeout(() => {
        this.playFormantSpeech(184, 150, 0.45, { f1: 520, f2: 1190, f3: 2390 }, { raspy: true, nasal: true, trollLaugh: true, volumeMultiplier: 1.3 });
      }, 280);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Spoken Vowel Accent: "GET REKT, NERD!"
   * The ultimate laughing troll cackle.
   * 1. "GET" (Vowel "EH")
   * 2. "REKT" (Vowel "EH" with high raspy tone)
   * 3. "NERD" (Vowel "UH" with robotic drop-down)
   */
  speakGetRekt() {
    if (this.isMuted) return;
    try {
      this.playFormantSpeech(250, 240, 0.22, { f1: 530, f2: 1840, f3: 2480 }, { tEnd: true, trollLaugh: true, volumeMultiplier: 1.4 });
      
      setTimeout(() => {
        this.playFormantSpeech(270, 250, 0.24, { f1: 530, f2: 1840, f3: 2480 }, { raspy: true, tEnd: true, trollLaugh: true, volumeMultiplier: 1.4 });
      }, 240);

      setTimeout(() => {
        this.playFormantSpeech(220, 160, 0.45, { f1: 520, f2: 1190, f3: 2390 }, { raspy: true, vibrato: true, trollLaugh: true, volumeMultiplier: 1.5 });
      }, 480);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Spoken Vowel Accent: "RENT DUE, BOYY!"
   * High-clarity cartoon giggles: "RENT DUE" -> "BOYYY" sliding low.
   */
  speakRentDue() {
    if (this.isMuted) return;
    try {
      this.playFormantSpeech(210, 200, 0.28, { f1: 530, f2: 1840, f3: 2480 }, { trollLaugh: true, volumeMultiplier: 1.2 });
      setTimeout(() => {
        this.playFormantSpeech(190, 180, 0.25, { f1: 270, f2: 2290, f3: 3010 }, { trollLaugh: true, volumeMultiplier: 1.2 });
      }, 260);
      setTimeout(() => {
        this.playFormantSpeech(220, 120, 0.75, { f1: 570, f2: 840, f3: 2410 }, { vibrato: true, nasal: true, trollLaugh: true, volumeMultiplier: 1.5 });
      }, 480);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Spoken Vowel Accent: "SELL IT!"
   * Wojak Skeleton scream. High-pitched, maniacal cackling laugh!
   */
  speakSellIt() {
    if (this.isMuted) return;
    try {
      this.playFormantSpeech(420, 390, 0.35, { f1: 530, f2: 1840, f3: 2480 }, { raspy: true, trollLaugh: true, volumeMultiplier: 1.4 });
      setTimeout(() => {
        this.playFormantSpeech(390, 310, 0.42, { f1: 270, f2: 2290, f3: 3010 }, { raspy: true, tEnd: true, trollLaugh: true, volumeMultiplier: 1.4 });
      }, 300);
    } catch (e) {
      console.error(e);
    }
  }

  /* ========================================================================
     Standard FX and Instruments
     ======================================================================== */

  playExplosion() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const duration = 1.2;

      // Noise source
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter to make it rumble
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration);

      const gain = this.createGain(ctx, now, duration, 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);

      // Add a sub-bass thump
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(120, now);
      sub.frequency.linearRampToValueAtTime(40, now + 0.3);

      const subGain = this.createGain(ctx, now, 0.4, 0.5);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.4);
    } catch (e) {
      console.error(e);
    }
  }

  playSadKazoo() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Descending sad horn march sound
      const notes = [310, 270, 240, 200]; 
      const dur = 0.28;

      notes.forEach((freq, idx) => {
        const time = now + idx * 0.24;
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.linearRampToValueAtTime(freq - 15, time + dur);

        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(freq * 1.5, time);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.linearRampToValueAtTime(0.0001, time + dur);

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(700, time);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc2.start(time);
        osc.stop(time + dur);
        osc2.stop(time + dur);
      });
    } catch (e) {
      console.error(e);
    }
  }

  playBonk() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const duration = 0.35;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.error(e);
    }
  }

  playCoinClink() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(987.77, now); 
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); 

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * SQUEAKY WET FART SOUND EFFECT
   * Oscillating deep sawtooth with pitch sweeps and random crackling
   */
  playLaserFart() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const duration = 1.1;

      // Vibrator Modulator to produce extreme rapid buzzing flapping
      const buzzMod = ctx.createOscillator();
      buzzMod.type = "sawtooth";
      buzzMod.frequency.setValueAtTime(14, now); // 14Hz air flap speed

      const flapSub = ctx.createOscillator();
      flapSub.type = "sawtooth";
      flapSub.frequency.setValueAtTime(125, now);
      flapSub.frequency.exponentialRampToValueAtTime(32, now + 0.9); // sweep downward

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Squishy low pass filter
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.linearRampToValueAtTime(110, now + 0.9);

      // Connect modulator to oscillator frequency to flap the pitch
      const flapGain = ctx.createGain();
      flapGain.gain.setValueAtTime(45, now);
      buzzMod.connect(flapGain);
      flapGain.connect(flapSub.frequency);

      flapSub.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      buzzMod.start(now);
      flapSub.start(now);
      
      buzzMod.stop(now + duration);
      flapSub.stop(now + duration);

    } catch (e) {
      console.error(e);
    }
  }

  playSlam() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Low pitch heavy strike
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.4);

      const gain = this.createGain(ctx, now, 0.45, 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);

      // Heavy noise burst
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const nFilter = ctx.createBiquadFilter();
      nFilter.type = "lowpass";
      nFilter.frequency.setValueAtTime(150, now);

      const nGain = this.createGain(ctx, now, 0.15, 0.5);
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.15);
    } catch (e) {
      console.error(e);
    }
  }

  playCrack() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const duration = 0.25;

      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2500, now);
      filter.Q.setValueAtTime(5, now);

      const gain = this.createGain(ctx, now, duration, 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {
      console.error(e);
    }
  }

  playWarDrums() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      // Heavy tribal war beat starting
      const pulses = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.35, 1.5];
      pulses.forEach((offset) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(90, now + offset);
        osc.frequency.exponentialRampToValueAtTime(40, now + offset + 0.18);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } catch (e) {
      console.error(e);
    }
  }

  playTrumpetVictory() {
    if (this.isMuted) return;
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const notes = [523.25, 523.25, 523.25, 659.25, 523.25, 659.25, 783.99]; // C5 C5 C5 E5 C5 E5 G5
      const durs = [0.1, 0.1, 0.1, 0.15, 0.1, 0.1, 0.3];
      const offsets = [0, 0.12, 0.24, 0.36, 0.52, 0.64, 0.76];

      notes.forEach((freq, idx) => {
        const time = now + offsets[idx];
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);

        // Add small vibrato
        const tremolo = ctx.createOscillator();
        tremolo.type = "sine";
        tremolo.frequency.setValueAtTime(6, time); // 6Hz

        const fGain = ctx.createGain();
        fGain.gain.setValueAtTime(freq * 0.02, time); // vibrato depth

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + durs[idx]);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + durs[idx]);
      });
    } catch (e) {
      console.error(e);
    }
  }

  private createGain(ctx: AudioContext, start: number, duration: number, startVal: number, endVal: number = 0) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(startVal, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(endVal, 0.0001), start + duration);
    return gain;
  }
}

export const soundSynth = new SoundSynth();
