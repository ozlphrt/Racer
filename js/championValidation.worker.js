import { validateChampion } from './championValidation.js';
self.onmessage = async ({ data }) => {
  try {
    const result = await validateChampion(data,
      progress => self.postMessage({ type: 'progress', ...progress }),
      () => new Promise(resolve => setTimeout(resolve, 0)));
    self.postMessage({ type: 'complete', result });
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
