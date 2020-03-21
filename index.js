const esutils = require('esutils');
const addDefault = require('@babel/helper-module-imports').addDefault;
const addNamed = require('@babel/helper-module-imports').addNamed;

let isInsideJsxExpression = function (t, path) {
  if (!path.parentPath) {
    return false;
  }
  if (t.isJSXExpressionContainer(path.parentPath)) {
    return true;
  }
  return isInsideJsxExpression(t, path.parentPath);
};

module.exports = function (babel) {
  let t = babel.types;

  return {
    name: 'transform-jsx-vue3',
    inherits: require('@babel/plugin-syntax-jsx').default,
    visitor: {
      JSXNamespacedName(path) {
        throw path.buildCodeFrameError(
          'Namespaced tags/attributes are not supported. JSX is not XML.\n' +
          'For attributes like xlink:href, use xlinkHref instead.',
        );
      },
      JSXElement: {
        exit(path, file) {
          // turn tag into createElement call
          let callExpr = buildElementCall(path.get('openingElement'), file);
          if (path.node.children.length) {
            // add children array as 3rd arg
            callExpr.arguments.push(t.arrayExpression(path.node.children));
            if (callExpr.arguments.length >= 3) {
              callExpr._prettyCall = true;
            }
          }
          path.replaceWith(t.inherits(callExpr, path.node));
        },
      },
      'Program'(path) {
        path.traverse({
          'ObjectMethod|ClassMethod'(path) {
            const params = path.get('params');
            // remove h if there is (h) param
            if (params.length && params[0].node.name === 'h') {
              params[0].remove();
            }
            // do nothing if there is no JSX inside
            const jsxChecker = {
              hasJsx: false,
            };
            path.traverse({
              JSXElement() {
                this.hasJsx = true;
              },
            }, jsxChecker);
            if (!jsxChecker.hasJsx) {
              return;
            }
            // do nothing if this method is a part of JSX expression
            if (isInsideJsxExpression(t, path)) {
              return;
            }

            // ------注入 h 函数
            let h = addNamed(path, 'h', 'vue', { nameHint: '_h_render' });

            path.get('body').unshiftContainer('body', t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('h'),
                h,
              ),
            ]));
          },
          JSXOpeningElement(path) {
            const attributes = path.get('attributes');
            const typeAttribute = attributes.find(attributePath => attributePath.node.name && attributePath.node.name.name === 'type');

            attributes.forEach(attributePath => {
              const attribute = attributePath.get('name');

              if (!attribute.node) {
                return;
              }

              const attr = attribute.node.name;


            });
          },
        });
      },
    },
  };

  function buildElementCall(path, file) {
    path.parent.children = t.react.buildChildren(path.parent);
    let tagExpr = convertJSXIdentifier(path.node.name, path.node);
    let args = [];

    let tagName;
    if (t.isIdentifier(tagExpr)) {
      tagName = tagExpr.name;
    } else if (t.isLiteral(tagExpr)) {
      tagName = tagExpr.value;
    }

    if (t.react.isCompatTag(tagName)) {
      args.push(t.stringLiteral(tagName));
    } else {
      args.push(tagExpr);
    }

    let attribs = path.node.attributes;
    if (attribs.length) {
      attribs = buildOpeningElementAttributes(attribs, path);
      args.push(attribs);
    }
    return t.callExpression(t.identifier('h'), args);
  }

  function convertJSXIdentifier(node, parent) {
    if (t.isJSXIdentifier(node)) {
      if (node.name === 'this' && t.isReferenced(node, parent)) {
        return t.thisExpression();
      } else if (esutils.keyword.isIdentifierNameES6(node.name)) {
        node.type = 'Identifier';
      } else {
        return t.stringLiteral(node.name);
      }
    } else if (t.isJSXMemberExpression(node)) {
      return t.memberExpression(
        convertJSXIdentifier(node.object, node),
        convertJSXIdentifier(node.property, node),
      );
    }
    return node;
  }

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containing
   * all prior attributes to an array for later processing.
   */

  function buildOpeningElementAttributes(attribs, path) {
    let _props = [];
    let objs = [];

    function pushProps() {
      if (!_props.length) return;
      objs.push(t.objectExpression(_props));
      _props = [];
    }

    while (attribs.length) {
      let prop = attribs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        pushProps();
        prop.argument._isSpread = true;
        objs.push(prop.argument);
      } else {
        _props.push(convertAttribute(prop));
      }
    }

    pushProps();

    // objs = objs.map(function (o) {
    //   return o._isSpread ? o : groupProps(o.properties, t)
    // })

    if (objs.length === 1) {
      // only one object
      attribs = objs[0];
    } else if (objs.length) {
      // add prop merging helper
      let helper = addDefault(path, 'babel-helper-vue-jsx-merge-props', { nameHint: '_mergeJSXProps' });
      // spread it
      attribs = t.callExpression(
        helper,
        [t.arrayExpression(objs)],
      );
    }
    return attribs;
  }

  function convertAttribute(node) {
    let value = convertAttributeValue(node.value || t.booleanLiteral(true));
    if (t.isStringLiteral(value) && !t.isJSXExpressionContainer(node.value)) {
      value.value = value.value.replace(/\n\s+/g, ' ');
    }
    if (t.isValidIdentifier(node.name.name)) {
      node.name.type = 'Identifier';
    } else {
      node.name = t.stringLiteral(node.name.name);
    }
    return t.inherits(t.objectProperty(node.name, value), node);
  }

  function convertAttributeValue(node) {
    if (t.isJSXExpressionContainer(node)) {
      return node.expression;
    } else {
      return node;
    }
  }
};
