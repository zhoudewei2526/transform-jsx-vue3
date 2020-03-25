var h = require("vue").h
var withDirectives = require("vue").withDirectives
function isObject(val) {
    return val !== null && typeof val === 'object';
}
function isVNode(value) {
    return value ? value._isVNode === true : false;
}
module.exports = function dynamicRender(type, propsOrChildren) {
    if (arguments.length > 1 && isObject(propsOrChildren) && !Array.isArray(propsOrChildren) && !isVNode(propsOrChildren)) {
        let directives = propsOrChildren["directives"];
        if (directives && directives.length > 0) {
            let directivesArr = directives.map(item => {
                return [item.dir, item.value, item.arg, item.modifiers];
            });
            return withDirectives(h(...arguments), directivesArr);
        }
    }
    return h(...arguments);
}
