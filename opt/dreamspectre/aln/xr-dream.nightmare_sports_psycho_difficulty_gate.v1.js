"use strict";

/**
 * Nightmare.Sports psycho-difficulty + eligibility gate
 * ALN-compatible, neurorights-aligned, no person-level scoring.
 * Depends only on state scalars and sleep-stage posteriors.
 *
 * NOTE: Do not include any [web] or [file] tokens in this code.
 */

/* ---------- Small utilities ---------- */

function clamp01(x) {
  if (!Number.isFinite(x)) return 0.0;
  if (x < 0.0) return 0.0;
  if (x > 1.0) return 1.0;
  return x;
}

/**
 * Lightweight 64-bit style mixer to create a deterministic hex commitment
 * over a numeric vector (spectral or safety state).
 */
function hashStateVector(vec) {
  let h = 0n;
  for (let i = 0; i < vec.length; i++) {
    const v = Number.isFinite(vec[i]) ? vec[i] : 0.0;
    const scaled = Math.trunc(v * 1e6);
    const n = BigInt(scaled);
    h ^= (n + 0x9e3779b185ebca87n);
    h = (h << 7n) | (h >> 57n);
    h ^= 0xc2b2ae3d27d4eb4fn;
  }
  const mask = (1n << 64n) - 1n;
  h &= mask;
  let hex = h.toString(16);
  if (hex.length < 16) hex = hex.padStart(16, "0");
  return "0x" + hex;
}

/* ---------- Sleep indices N1/N2/N3/? and Gsafe ---------- */

/**
 * Compute N1/N2/N3/? indices and Gsafe from stage posteriors.
 * posteriors: { pWake, pN1, pN2, pN3, pREM }
 * Uses Dream_Spectre syntax: DN2N3 depth, U? uncertainty, Gsafe gate.
 */
function computeSleepIndices(posteriors) {
  const pWake = clamp01(posteriors.pWake || 0.0);
  const pN1   = clamp01(posteriors.pN1   || 0.0);
  const pN2   = clamp01(posteriors.pN2   || 0.0);
  const pN3   = clamp01(posteriors.pN3   || 0.0);
  const pREM  = clamp01(posteriors.pREM  || 0.0);

  let sum = pWake + pN1 + pN2 + pN3 + pREM;
  if (sum <= 0.0) sum = 1.0;

  const nWake = pWake / sum;
  const n1    = pN1   / sum;
  const n2    = pN2   / sum;
  const n3    = pN3   / sum;
  const nREM  = pREM  / sum;

  const dN2N3 = clamp01(0.5 * n2 + 1.0 * n3);
  const maxP  = Math.max(nWake, n1, n2, n3, nREM);
  const uQ    = clamp01(1.0 - maxP);
  const gSafe = clamp01(dN2N3 - 0.5 + (1.0 - uQ)); // favors deep, certain N2/N3

  let coarseRegion = "UNKNOWN";
  if (maxP === nWake) coarseRegion = "WAKE";
  else if (maxP === nREM) coarseRegion = "REM";
  else if (maxP === n1) coarseRegion = "N1";
  else if (maxP === n2) coarseRegion = "N2";
  else if (maxP === n3) coarseRegion = "N3";

  return {
    pWake: nWake,
    pN1: n1,
    pN2: n2,
    pN3: n3,
    pREM: nREM,
    dN2N3,
    uQuestion: uQ,
    gSafe,
    coarseRegion
  };
}

/* ---------- Eligibility scalar E = S·(1-R)·Es ---------- */

/**
 * Compute eligibility scalar E = S * (1 - R) * Es.
 * S: sleeptoken (N2/N3 depth & timing)
 * R: psychrisk scalar (distress, LF/HF, PLV, etc.)
 * Es: enstasis (Organic-CPU stability + crate_validation_level).
 */
function computeE(sleeptoken, psychrisk, enstasis) {
  const S  = clamp01(sleeptoken);
  const R  = clamp01(psychrisk);
  const Es = clamp01(enstasis);
  return S * (1.0 - R) * Es;
}

/* ---------- PsychoDifficultyEthicsProfile ---------- */

/**
 * PDEP configuration (infra-only).
 * These values SHOULD be loaded from an ALN shard in production.
 */
const PsychoDifficultyEthicsProfile = Object.freeze({
  monotone_in_psychrisk: true,
  consent_scarcity_floor: 0.4,   // MentalScarcity > 0.4 forbids high intensity
  n3_emotional_gate_min: 0.72,   // N3EmotionalStabilizationGate floor
  max_fear_dose_night: 0.25,     // fraction of N2/N3 minutes per night
  max_consecutive_high_intensity_epochs: 4,
  requires_agency_preservation: true
});

/* ---------- NightmareSportsEligibilityProfile check ---------- */

/**
 * NS eligibility snapshot combines E, N3 gate, MentalScarcity, NSAlign.
 * nsState: {
 *   sleeptoken, psychrisk, enstasis,
 *   n3_emotional_gate, mentalscarcity, nsalign,
 *   minutesSinceOnset, sleepstage,
 *   lf_hf_ratio, theta_gamma_plv,
 *   fear_dose_fraction, consecutive_high_intensity_epochs,
 *   agency_preserved
 * }
 */
function evaluateNightmareSportsEligibility(nsState) {
  const idx = computeSleepIndices(nsState.posteriors || {});
  const E   = computeE(nsState.sleeptoken, nsState.psychrisk, nsState.enstasis);

  const stage = nsState.sleepstage;
  const inMidN2N3Window =
    (stage === "N2" || stage === "N3") &&
    nsState.minutesSinceOnset >= 20.0 &&
    nsState.minutesSinceOnset <= 40.0;

  const lfHfOk   = (nsState.lf_hf_ratio || 0.0) < 2.8;
  const plvOk    = (nsState.theta_gamma_plv || 0.0) > 0.19;
  const arousalOk = lfHfOk && plvOk;

  const ePositive = E > 0.0;
  const n3GateOk  = (nsState.n3_emotional_gate || 0.0) >= PsychoDifficultyEthicsProfile.n3_emotional_gate_min;
  const scarcityOk = (nsState.mentalscarcity || 0.0) <= PsychoDifficultyEthicsProfile.consent_scarcity_floor;
  const nsAlignOk  = (nsState.nsalign || 0.0) >= 0.5;

  const doseOk =
    (nsState.fear_dose_fraction || 0.0) <= PsychoDifficultyEthicsProfile.max_fear_dose_night * 0.8; // 80% safety margin
  const consecOk =
    (nsState.consecutive_high_intensity_epochs || 0) <= PsychoDifficultyEthicsProfile.max_consecutive_high_intensity_epochs;

  const agencyOk =
    !PsychoDifficultyEthicsProfile.requires_agency_preservation || !!nsState.agency_preserved;

  const gSafeHigh = idx.gSafe >= 0.7;

  const allowHighIntensity =
    inMidN2N3Window &&
    ePositive &&
    n3GateOk &&
    scarcityOk &&
    nsAlignOk &&
    arousalOk &&
    doseOk &&
    consecOk &&
    agencyOk &&
    gSafeHigh;

  const spectralHex = hashStateVector([
    E,
    idx.dN2N3,
    idx.uQuestion,
    idx.gSafe,
    nsState.lf_hf_ratio || 0.0,
    nsState.theta_gamma_plv || 0.0,
    nsState.mentalscarcity || 0.0,
    nsState.n3_emotional_gate || 0.0
  ]);

  return {
    E,
    indices: idx,
    allowHighIntensity,
    forceSafeMode: !allowHighIntensity,
    spectralHex
  };
}

/* ---------- Psycho-difficulty difficulty clamp ---------- */

/**
 * Enforce D(f_stage, R) monotone in psychrisk R.
 * Given a proposed difficulty in [0,1] and psychrisk, returns a clamped difficulty.
 */
function clampDifficultyByPsychrisk(proposedDifficulty, psychrisk) {
  const R = clamp01(psychrisk);
  const D0 = clamp01(proposedDifficulty);
  // Simple strictly non-increasing envelope: D_max(R) = 1 - R
  const Dmax = 1.0 - R;
  return Math.min(D0, Dmax);
}

/* ---------- NightmareSportsCeilingGate (single entrypoint) ---------- */

/**
 * Main gate function: decides Nightmare.Sports rendering mode for this epoch.
 *
 * inputs: {
 *   nsState: see evaluateNightmareSportsEligibility,
 *   proposedDifficulty: 0..1,
 *   neurorights: { mentalprivacy, cognitiveliberty, mentalintegrity, nopunitivexr }
 * }
 *
 * returns:
 *   {
 *     allowNightmareSports: bool,
 *     highIntensity: bool,
 *     difficulty: float 0..1,
 *     route: "NIGHTMARE_SPORTS" | "SAFE_ROOM" | "RESTORATIVE",
 *     spectralHex: "0x...."
 *   }
 */
function NightmareSportsCeilingGate(inputs) {
  const rights = inputs.neurorights || {};
  const rightsOK =
    !!rights.mentalprivacy &&
    !!rights.cognitiveliberty &&
    !!rights.mentalintegrity &&
    !!rights.nopunitivexr;

  if (!rightsOK) {
    return {
      allowNightmareSports: false,
      highIntensity: false,
      difficulty: 0.0,
      route: "RESTORATIVE",
      spectralHex: hashStateVector([0, 0, 0, 0])
    };
  }

  const evalRes = evaluateNightmareSportsEligibility(inputs.nsState);
  const difficulty = clampDifficultyByPsychrisk(
    inputs.proposedDifficulty || 0.0,
    inputs.nsState.psychrisk || 0.0
  );

  if (!evalRes.allowHighIntensity) {
    // Route into safe archetypes (pressure-valve deferred)
    const route = evalRes.E > 0.0 ? "SAFE_ROOM" : "RESTORATIVE";
    return {
      allowNightmareSports: false,
      highIntensity: false,
      difficulty: 0.0,
      route,
      spectralHex: evalRes.spectralHex
    };
  }

  // High-intensity Nightmare.Sports allowed under all invariants
  return {
    allowNightmareSports: true,
    highIntensity: true,
    difficulty,
    route: "NIGHTMARE_SPORTS",
    spectralHex: evalRes.spectralHex
  };
}

/* ---------- Hex grounding string for this module ---------- */

const NIGHTMARE_SPORTS_GATE_HEX = "0x93af1c7de4b14f0ea2d6c5b8e7a903d2";

/* ---------- Exports ---------- */

module.exports = {
  clamp01,
  hashStateVector,
  computeSleepIndices,
  computeE,
  PsychoDifficultyEthicsProfile,
  evaluateNightmareSportsEligibility,
  clampDifficultyByPsychrisk,
  NightmareSportsCeilingGate,
  NIGHTMARE_SPORTS_GATE_HEX
};
