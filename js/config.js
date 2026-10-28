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
    accel: 480, // High-performance modern 1000hp hybrid F1 acceleration (units/s²)
    brake: 720, // Deeper, more responsive braking
    drag: 0.16, // Aerodynamic drag
    maxSpeed: 480, // Realistic modern F1 top speed ceiling (~375 km/h with 0.78 scale)
    turnRate: 3.9, // Agile apex steering
    minTurnSpeed: 45, // Steering response onset
    highSpeedTurnLoss: 0.28,
    tireGrip: 4.5, // Balanced F1 slick grip: authentic slip angle, visible skidmarks, and progressive rotation (not glued on rails)
    understeerFactor: 0.0042, // Front tire scrub under heavy cornering
    oversteerFactor: 0.42, // Dynamic throttle-steer rotation on corner exit
    yawResponseSec: 0.035, // Crisp chassis response (eliminates 120ms phase lag wagging)
    latGripBase: 105, // Balanced mechanical cornering grip
    latGripPerSpeed: 0.58, // Progressive aero downforce that builds with speed
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
    length: 420, // Extended forward vision: allows early high-speed corner anticipation and braking
    lookaheadDistances: [120, 260, 480], // Extended horizons: early corner entry, apex transition, and multi-apex chicane exit
  },

  // 7 rays + speed (base) + lateral pos + 3 curvature lookaheads (staged: frozen at zero until a car finishes) → steer, throttle
  nn: { layers: [12, 12, 8, 2], baseInputs: 8 },

  ga: {
    population: 20, // 20-Car F1 Grid (blistering fast simulation speed & clean racing lines)
    elites: 2, // Keep top 2 champions unchanged (guarantees proven race pace survival)
    tournamentK: 3, // Tournament selection size
    mutationRate: 0.20, // Elevated mutation rate to discover new braking and apex lines
    mutationSigma: 0.28, // Expanded precision micro-tuning
  },

  generation: {
    timeLimit: 180, // sim seconds: generous time for learning cars (~36s per lap for a five-lap race)
    startDelay: 2.0, // seconds for F1 starting lights sequence (red -> green launch)
    maxLaps: 5, // a car "finishes" after this many laps
    finishWindow: 15, // seconds for healthy trailing cars after the first finisher
    stallTime: 7.0, // seconds without new progress → eliminated (ample time to overtake traffic)
    backwardsTolerance: 80, // track samples a car may fall behind before elimination (allows 180° turnaround recovery)
    startGracePeriod: 5.0, // seconds at generation start where stall elimination is suppressed
  },

  fitness: {
    speedPaceWeight: 40, // Weight for average speed (distance / time): rewards fast laps and race completion
    crashPenalty: 500, // Penalty for hitting outer barrier / deep off-track
    contactPenalty: 50, // Penalty per vehicle contact when collisions are active
    steerSmoothWeight: 12, // Penalty weight for steering jerk / erratic lock-to-lock switching
    scrubWeight: 20, // Penalty weight for excessive lateral tire scrub / mid-corner power slide
    lookaheadLineBonus: 25, // Bonus for positioning on the outside before corner entry (anticipating upcoming curvature)
  },
};
