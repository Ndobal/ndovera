// Router framework code deliberately leaves webpackIgnore imports in its output.
// Even unused functions containing that syntax stop old engines parsing the app.
// Keep the native syntax in a separate module script, loaded only by modern engines.
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path, state) {
        if (!/[\\/]node_modules[\\/]react-router[\\/]/.test(state.filename || '')) return;
        if (path.node.callee.type !== 'Import') return;
        path.replaceWith(t.callExpression(
          t.memberExpression(t.identifier('window'), t.identifier('__ndoveraImportModule')),
          path.node.arguments,
        ));
      },
    },
  };
};
