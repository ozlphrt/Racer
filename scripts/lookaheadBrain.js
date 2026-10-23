// Offline-only model. Not imported by the live app or compatible with its
// eight-input brain format. Zero new weights preserve the original policy.
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { clamp } from '../js/math.js';

export const LOOKAHEAD_LAYERS = [12, 12, 8, 2];
export function upgradeGenome(genome) {
  if (genome.length === NeuralNetwork.genomeSize(LOOKAHEAD_LAYERS) && Array.from(genome).every(Number.isFinite)) {
    return Float32Array.from(genome);
  }
  if (genome.length !== NeuralNetwork.genomeSize([8, 12, 8, 2]) || !Array.from(genome).every(Number.isFinite)) {
    throw new Error('Expected a finite 8-12-8-2 genome.');
  }
  const upgraded = new Float32Array(NeuralNetwork.genomeSize(LOOKAHEAD_LAYERS));
  for (let neuron = 0; neuron < 12; neuron++) {
    for (let input = 0; input < 8; input++) upgraded[neuron * 13 + input] = genome[neuron * 9 + input];
    upgraded[neuron * 13 + 12] = genome[neuron * 9 + 8];
  }
  upgraded.set(Array.from(genome).slice(108), 156);
  return upgraded;
}

export class LookaheadBrain extends NeuralNetwork {
  constructor(genome, masked = false, distances = [80, 180]) {
    super(LOOKAHEAD_LAYERS, genome);
    if (distances.length !== 2 || !distances.every(d => Number.isFinite(d) && d > 0)) throw new Error('Two positive lookahead distances are required.');
    this.expandedInputs = new Float32Array(12);
    this.car = null;
    this.masked = masked;
    this.distances = distances;
  }
  forward(inputs) {
    const values = this.expandedInputs;
    values.set(inputs);
    const car = this.car;
    if (!car) throw new Error('Attach the car before using lookahead inference.');
    const t = car.track, index = car.idx;
    const lateral = ((car.x - t.cx[index]) * -t.ty[index] + (car.y - t.cy[index]) * t.tx[index]) / t.half;
    const heading = Math.atan2(t.ty[index], t.tx[index]) - car.angle;
    values[8] = this.masked ? 0 : clamp(lateral, -1, 1);
    values[9] = this.masked ? 0 : Math.atan2(Math.sin(heading), Math.cos(heading)) / Math.PI;
    for (let feature = 0; feature < 2; feature++) {
      const ahead = t.wrap(index + Math.round(this.distances[feature] / t.spacing));
      let curvature = 0;
      for (let offset = -2; offset <= 2; offset++) curvature += t.curvature[t.wrap(ahead + offset)];
      values[10 + feature] = this.masked ? 0 : clamp(curvature / 5 * t.half, -1, 1);
    }
    return super.forward(values);
  }
}
