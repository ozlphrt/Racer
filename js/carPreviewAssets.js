// Generated from the prepared race meshes using scripts/car-preview-studio.html.
// Keep these as static assets: thumbnail GPU readback must not run during racing.
export const CAR_PREVIEW_KEYS = new Set([
  'c_0_44', 'c_0_63', 'c_1_16', 'c_1_55', 'c_2_1', 'c_2_11',
  'c_3_4', 'c_3_81', 'c_4_14', 'c_4_18', 'c_5_10', 'c_5_31',
  'c_6_23', 'c_6_2', 'c_7_3', 'c_7_22', 'c_8_77', 'c_8_24',
  'c_9_20', 'c_9_27', 'p_1_7',
]);

export function carPreviewAsset(key) {
  return CAR_PREVIEW_KEYS.has(key) ? `${import.meta.env?.BASE_URL || '/'}car-previews/${key}.png` : null;
}
