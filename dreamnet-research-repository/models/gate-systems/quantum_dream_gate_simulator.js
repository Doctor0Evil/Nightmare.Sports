const QuantumDreamGate = {
  defaults: {
    arousalMax: 0.4,      // normalized 0-1
    auraSafetyBand: 0.6,
    Rmax: 0.7,
    Emin: 0.3,
    N3LoadThreshold: 0.65
  },

  evaluate(inputs) {
    const {
      arousal = 0.3,
      immersion = 0.5,
      risk = 0.4,
      emotionalIntensity = 0.4,
      stage = 'N3',
      minutesInStage = 25,
      n3EmotionalLoad = 0.5
    } = inputs;

    const baseEligibility = 
      minutesInStage >= 20 && minutesInStage <= 40 &&
      (stage === 'N2' || stage === 'N3') &&
      arousal <= this.defaults.arousalMax &&
      immersion <= this.defaults.auraSafetyBand &&
      risk <= this.defaults.Rmax &&
      emotionalIntensity >= this.defaults.Emin;

    if (!baseEligibility) return { zone: 'Safe Shells / Neutral', archetype: null };

    const n3GateOpen = n3EmotionalLoad >= this.defaults.N3LoadThreshold;
    const emoHot = n3GateOpen && stage === 'N3';

    if (emoHot) {
      return { zone: 'Combat-like zones', archetype: 'PrimalCombatArchetype', integration: 'WholenessAnchor' };
    }

    // Archetype selector fallback (simplified)
    const archetypes = ['Restoration', 'Rehearsal', 'Neutral'];
    const selected = archetypes[Math.floor(Math.random() * archetypes.length)];

    return { zone: `Zones${selected}`, archetype: selected, integration: 'WholenessAnchor' };
  }
};

// Example usage (deployable in Node or browser with mock EEG stream)
const sampleInput = {
  arousal: 0.35,
  immersion: 0.55,
  risk: 0.45,
  emotionalIntensity: 0.45,
  stage: 'N3',
  minutesInStage: 32,
  n3EmotionalLoad: 0.72
};

console.log(QuantumDreamGate.evaluate(sampleInput));
