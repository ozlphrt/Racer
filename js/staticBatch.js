import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Draw repeated scenery parts together, retaining individual frustum tests and sorting. */
export function batchSceneryInstances(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const { geometry, material } = entry;
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}:${attr.array.constructor.name}`).join(',');
    const key = `${material.uuid}|${Boolean(geometry.index)}|${attributes}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].map(parts => {
    const geometries = [...new Set(parts.map(part => part.geometry))];
    const instances = parts.reduce((sum, part) => sum + part.matrices.length, 0);
    const vertices = geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
    const indices = geometries.reduce((sum, geometry) => sum + (geometry.index?.count || 0), 0);
    const batch = new THREE.BatchedMesh(instances, vertices, indices, parts[0].material);
    const ids = new Map(geometries.map(geometry => [geometry, batch.addGeometry(geometry)]));
    for (const part of parts) {
      for (const matrix of part.matrices) batch.setMatrixAt(batch.addInstance(ids.get(part.geometry)), matrix);
    }
    batch.perObjectFrustumCulled = true;
    batch.sortObjects = Boolean(parts[0].material.transparent);
    batch.computeBoundingSphere();
    batch.matrixAutoUpdate = false;
    batch.updateMatrix();
    batch.userData.isSharedTemplate = true;
    return batch;
  });
}

/** Keep instance bounds local so off-screen scenery can be culled by the camera. */
export function partitionInstances(matrices, cellSize = 384) {
  const cells = new Map();
  for (const matrix of matrices) {
    const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[13] / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(matrix);
  }
  return [...cells.values()];
}

/** Bake fixed scenery into batches without changing its materials or triangle count. */
export function batchStaticMeshes(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverseVisible((mesh) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh ||
      Array.isArray(mesh.material) || mesh.material.transparent) return;
    const attributes = Object.keys(mesh.geometry.attributes).sort().join(',');
    const key = [mesh.material.uuid, attributes, Boolean(mesh.geometry.index), mesh.renderOrder,
      mesh.castShadow, mesh.receiveShadow, mesh.layers.mask].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((part) => part.dispose());
    if (!geometry) continue;
    const first = meshes[0];
    const batch = new THREE.Mesh(geometry, first.material);
    batch.name = 'Static scenery batch';
    batch.renderOrder = first.renderOrder;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.layers.mask = first.layers.mask;
    batch.matrixAutoUpdate = false;
    batch.updateMatrix();
    meshes.forEach((mesh) => mesh.removeFromParent());
    root.add(batch);
  }
}
