module.exports = function frappeVueStyle() {
  return {
    name: 'frappe-vue-style',
    setup(build) {
      build.onEnd(result => {
        const outputs = result.metafile && result.metafile.outputs;
        if (!outputs) return;
        // Further processing of outputs can be added here if needed
      });
    }
  };
};
