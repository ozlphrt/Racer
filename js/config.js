// All tunable constants live here so experiments only touch one file.
export const CONFIG = {
  dt: 1 / 60, // fixed physics timestep (seconds)
  budgetMs: 12, // max simulation time per animation frame (keeps UI responsive)

  world: { margin: 60 },

  track: { width: 84, samples: 400 },

  car: {
    length: 26,
    width: 13,
    accel: 345, // High-performance F1 acceleration (units/s²)
    brake: 640, // Deeper, more responsive braking
    drag: 0.23, // Lower aerodynamic drag for blistering top speeds
    maxSpeed: 480, // Higher top speed ceiling (unlocks sub-8.5s potential)
    turnRate: 3.9, // Higher agility apex steering
    minTurnSpeed: 50, // Low speed steering authority threshold
    highSpeedTurnLoss: 0.36, // Downforce-stabilized high speed steering
    tireGrip: 14.2, // Upgraded downforce lateral tire grip for apex cornering
    understeerFactor: 0.0022,
    oversteerFactor: 0.18,
  },

  collision: {
    enabled: true, // Physical collision physics & avoidance enabled
    warmupTime: 30, // Collision avoidance starts after 30 seconds of race time
    separationLeadTime: 25, // Repelling & safe spacing active between 25s and 0s on collision timer
    radius: 13.5, // collision bounding radius (ensures 26x13 cars never touch each other)
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
    targetLapTime: 8.8, // Aggressive target lap time; exponentially rewards sub-9.0s pace
    crashPenalty: 600, // Strict penalty for crashing into walls/runoff (rewards staying on track)
    contactPenalty: 50, // Penalty per contact after grace period (penalizes collisions)
    cleanRaceBonus: 3500, // Massive bonus for completing laps with 0 collision contacts
    p1Bonus: 5000, // High reward for winning the race / finishing ahead in P1
    p2Bonus: 2500, // Reward for 2nd place
    p3Bonus: 1500, // Reward for 3rd place
  },
};
