// Remotion's bundler imports @rspack/core at load time even when bundling with webpack (the default).
// The Rspack native binary crashes in some containers, so stub it out; webpack does the bundling.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS hook must patch Module._load
const Module = require('node:module');
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@rspack/core' || request === '@rspack/plugin-react-refresh') {
    const stub = () => {
      throw new Error('Rspack is disabled in this project; bundle with webpack.');
    };
    return Object.assign(stub, { rspack: stub, default: stub });
  }
  return load.call(this, request, ...rest);
};
