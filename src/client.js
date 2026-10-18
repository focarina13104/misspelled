export function createWordClient({ workerFactory, onChange = () => {} }) {
  let worker;
  let ready = false;
  let disposed = false;
  let generation = 0;
  let pending = null;
  let state = { input: '', status: 'loading', mode: null, result: null, errorCode: null };
  const getState = () => ({ ...state, result: state.result ? { ...state.result, ...(state.result.suggestions ? { suggestions: [...state.result.suggestions] } : {}) } : null });
  function update(patch) {
    state = { ...state, ...patch };
    onChange(getState());
  }
  function invalidate() { generation++; pending = null; }
  function initialize() {
    invalidate();
    ready = false;
    worker?.terminate();
    worker = null;
    update({ status: 'loading', mode: null, result: null, errorCode: null });
    try {
      const current = workerFactory();
      worker = current;
      current.onmessage = ({ data }) => {
        if (disposed || worker !== current) return;
        if (data.type === 'ready') {
          if (!ready) { ready = true; update({ status: 'idle', errorCode: null }); }
          return;
        }
        if (data.type === 'initError') {
          ready = false;
          invalidate();
          update({ status: 'error', result: null, errorCode: 'initError' });
          return;
        }
        if (data.id !== pending || data.id !== generation || data.mode !== state.mode) return;
        pending = null;
        if (data.errorCode) update({ status: 'error', result: null, errorCode: 'operationFailed' });
        else update({ status: 'result', result: data.result, errorCode: null });
      };
      current.onerror = current.onmessageerror = event => {
        event.preventDefault?.();
        if (disposed || worker !== current) return;
        const errorCode = ready ? 'operationFailed' : 'initError';
        ready = false;
        invalidate();
        update({ status: 'error', result: null, errorCode });
      };
    } catch {
      update({ status: 'error', errorCode: 'initError' });
    }
  }
  function setInput(input) {
    if (disposed) return;
    input = input.replace(/[A-Z]/g, letter => letter.toLowerCase());
    invalidate();
    update({ input, result: null, mode: null, status: ready ? 'idle' : state.status === 'error' ? 'error' : 'loading', errorCode: ready ? null : state.errorCode });
  }
  function run(mode, input = state.input) {
    if (disposed || !ready || !['check', 'similar'].includes(mode)) return;
    invalidate();
    pending = generation;
    update({ status: 'busy', mode, result: null, errorCode: null });
    try { worker.postMessage({ id: pending, mode, input }); }
    catch { pending = null; update({ status: 'error', errorCode: 'operationFailed' }); }
  }
  initialize();
  return {
    getState, setInput, run,
    clear() { setInput(''); },
    retry() { if (!disposed) initialize(); },
    dispose() { disposed = true; invalidate(); worker?.terminate(); },
  };
}
