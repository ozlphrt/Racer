// All tunable constants live here so experiments only touch one file.
export const CONFIG = {
  dt: 1 / 60, // fixed physics timestep (seconds)
  budgetMs: 12, // max simulation time per animation frame (keeps UI responsive)

  gridBox: true, // F1 2x2 staggered starting grid formation and visual grid box markings
  gridOrder: 'qualifying', // Starting grid mode: 'qualifying' (Q3/Q2/Q1 dynamic qualifying shootout), 'reverse8' (F2 sprint), or 'random' (lottery)

  world: { margin: 60 },

  track: { width: 84, samples: 400 },

  car: {
    length: 26,
    width: 13,
    accel: 345, // High-performance F1 acceleration (units/s²)
    brake: 640, // Deeper, more responsive braking
    drag: 0.23, // Aerodynamic drag
    maxSpeed: 435, // Realistic modern F1 top speed ceiling (~340 km/h with 0.78 scale)
    turnRate: 3.8, // Agile apex steering
    minTurnSpeed: 45, // Steering response onset
    highSpeedTurnLoss: 0.32,
    tireGrip: 8.2, // Calibrated lateral tire grip: authentic progressive slip and drift dynamics (down from 14.2)
    understeerFactor: 0.0035, // High-speed front tire scrub on aggressive corner entry
    oversteerFactor: 0.32, // Power oversteer and throttle-steer rotation on corner exit
  },

  collision: {
    enabled: false, // Ghost mode permanently ON all time (no car-to-car collision or nudges)
    warmupTime: Infinity, // Permanent ghost mode
    separationLeadTime: 0,
    radius: 13.5, // collision bounding radius
    restitution: 0.45, // elasticity of bumping contact
    scrub: 0.04, // slight speed scrub on contact
  },

  sensors: {
    angles: [-90, -60, -30, 0, 30, 60, 90], // degrees relative to heading (negative = left)
    length: 240,
  },

  nn: { layers: [8, 12, 8, 2] }, // 7 rays + speed → steer, throttle

  ga: {
    population: 20, // 20-Car F1 Grid (blistering fast simulation speed & clean racing lines)
    elites: 2, // Keep top 2 champions unchanged (guarantees proven race pace survival)
    tournamentK: 3, // Tournament selection size
    mutationRate: 0.16, // Elevated mutation rate to discover new braking and apex lines
    mutationSigma: 0.24, // Expanded precision micro-tuning
  },

  generation: {
    timeLimit: 85, // sim seconds (ample time to complete full 5-lap races)
    startDelay: 2.0, // seconds for F1 starting lights sequence (red -> green launch)
    maxLaps: 5, // a car "finishes" after this many laps
    stallTime: 7.0, // seconds without new progress → eliminated (ample time to overtake traffic)
    backwardsTolerance: 80, // track samples a car may fall behind before elimination (allows 180° turnaround recovery)
    startGracePeriod: 5.0, // seconds at generation start where stall elimination is suppressed
  },

  fitness: {
    lapBonus: 4500, // Large reward per completed lap
    fullRaceBonus: 30000, // Massive milestone bonus for completing all 5 laps
    targetLapTime: 8.54, // Benchmark target lap time matching historic 8.54s record; exponentially rewards sub-9.0s pace
    crashPenalty: 600, // Strict penalty for crashing into walls/runoff (rewards staying on track)
    contactPenalty: 50, // Penalty per contact after grace period (penalizes collisions)
    cleanRaceBonus: 3500, // Massive bonus for completing laps with 0 collision contacts
    p1Bonus: 5000, // High reward for winning the race / finishing ahead in P1
    p2Bonus: 2500, // Reward for 2nd place
    p3Bonus: 1500, // Reward for 3rd place
  },
};
