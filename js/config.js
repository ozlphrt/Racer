// All tunable constants live here so experiments only touch one file.
export const CONFIG = {
  dt: 1 / 60, // fixed physics timestep (seconds)
  budgetMs: 12, // max simulation time per animation frame (keeps UI responsive)

  world: { margin: 60 },

  track: { width: 84, samples: 400 },

  car: {
    length: 26,
    width: 13,
    accel: 300, // High-performance F1 acceleration (units/s²)
    brake: 550, // Responsive braking
    drag: 0.26, // Low aerodynamic drag for high top speeds
    maxSpeed: 440, // Blistering top speed
    turnRate: 3.6, // High-agility steering
    minTurnSpeed: 50, // Low speed steering authority threshold
    highSpeedTurnLoss: 0.38, // Downforce-stabilized high speed steering
    tireGrip: 12.5, // High downforce lateral tire grip
    understeerFactor: 0.0025,
    oversteerFactor: 0.20,
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
    elites: 1, // Keep #1 champion unchanged
    tournamentK: 3, // Tournament selection size
    mutationRate: 0.16, // Adaptive mutation rate to quickly master multi-car dynamics
    mutationSigma: 0.32,
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
    targetLapTime: 10.0, // Target lap time; faster laps earn exponential extra speed bonus
    crashPenalty: 600, // Strict penalty for crashing into walls/runoff (rewards staying on track)
    contactPenalty: 50, // Penalty per contact after grace period (penalizes collisions)
    cleanRaceBonus: 3500, // Massive bonus for completing laps with 0 collision contacts
    p1Bonus: 5000, // High reward for winning the race / finishing ahead in P1
    p2Bonus: 2500, // Reward for 2nd place
    p3Bonus: 1500, // Reward for 3rd place
  },
};
