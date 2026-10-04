import { randn } from './math.js';

/**
 * Fixed-topology MLP with tanh activations.
 * All weights + biases live in one flat Float32Array genome so the GA can treat it as a vector.
 * Layout per layer: for each output neuron j → [w(0→j) … w(nIn-1→j), bias_j].
 */
export class NeuralNetwork {
  constructor(layers, genome = null) {
    this.layers = layers;
    this.offsets = NeuralNetwork.layerOffsets(layers);
    this.genome = genome ? Float32Array.from(genome) : NeuralNetwork.randomGenome(layers);
    this.activations = layers.map((n) => new Float32Array(n));
  }

  static layerOffsets(layers) {
    const offs = [];
    let p = 0;
    for (let l = 0; l < layers.length - 1; l++) {
      offs.push(p);
      p += (layers[l] + 1) * layers[l + 1];
    }
    return offs;
  }

  static genomeSize(layers) {
    let s = 0;
    for (let l = 0; l < layers.length - 1; l++) s += (layers[l] + 1) * layers[l + 1];
    return s;
  }

  static randomGenome(layers) {
    const g = new Float32Array(NeuralNetwork.genomeSize(layers));
    let p = 0;
    for (let l = 0; l < layers.length - 1; l++) {
      const nIn = layers[l];
      const scale = 1.8 / Math.sqrt(nIn);
      for (let k = 0; k < (nIn + 1) * layers[l + 1]; k++) g[p++] = randn() * scale;
    }
    return g;
  }

  forward(inputs) {
    const act = this.activations;
    const g = this.genome;
    const a0 = act[0];
    for (let i = 0; i < a0.length; i++) a0[i] = inputs[i];
    let p = 0;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const inp = act[l];
      const out = act[l + 1];
      const nIn = inp.length;
      for (let j = 0; j < out.length; j++) {
        let s = 0;
        for (let i = 0; i < nIn; i++) s += inp[i] * g[p++];
        s += g[p++];
        out[j] = Math.tanh(s);
      }
    }
    return act[act.length - 1];
  }

  /** Weight from neuron i in layer l to neuron j in layer l+1. */
  weight(l, i, j) {
    return this.genome[this.offsets[l] + j * (this.layers[l] + 1) + i];
  }
}
