
let nestRE = /^(on|nativeOn|class|style|hook)$/;
// 首字母转为大写
function firstWordCase(nestedKey) {
  let nestedKeyArr = nestedKey.split('');
  let upperCaseKey = nestedKeyArr.splice(0, 1, nestedKeyArr[0].toUpperCase()).join('');
  return upperCaseKey;
}
module.exports = function mergeJSXProps(objs) {
  if(objs.length===1){
    [{}].concat(objs)
  }
  return objs.reduce(function (a, b) {
    let aa, bb, key, nestedKey, temp;
    for (key in b) {
      aa = a[key];
      bb = b[key];
      if (aa && nestRE.test(key)) {
        // 处理class，如果数据对象是形如{class:'classA'}的，则处理成{class:{'classA':true}}
        if (key === 'class') {
          if (typeof aa === 'string') {
            temp = aa;
            a[key] = aa = {};
            aa[temp] = true;
          }
          if (typeof bb === 'string') {
            temp = bb;
            b[key] = bb = {};
            bb[temp] = true;
          }
        }
        let isHook = false;
        
        if (key === 'on' || key === 'nativeOn' || (isHook = key === 'hook')) {
          // merge functions
          for (nestedKey in bb) {
            /** hook处理同vue2一样*/
            if (isHook) {
              aa[nestedKey] = mergeFn(aa[nestedKey], bb[nestedKey]);
            } else/** 为了兼容老代码，传入为{on:{click:fnA}}时，则会转为{onClick:fnA}*/ {
              let upperCaseKey = firstWordCase(nestedKey);
              aa['on' + upperCaseKey] = mergeFn(aa[nestedKey], bb[nestedKey]);
            }
          }
          a = aa;
        } 
        else if (Array.isArray(aa)) {
          a[key] = aa.concat(bb);
        } else if (Array.isArray(bb)) {
          a[key] = [aa].concat(bb);
        } else {
          for (nestedKey in bb) {
            aa[nestedKey] = bb[nestedKey];
          }
        }
      }
      /** attrs和props属性都应该被平铺 */ 
      else if (/attrs|props/.test(key)) {
        for (let subkey in b[key]) {
          a[subkey] = b[key][subkey];
        }
      } else {
        a[key] = b[key];
      }
    }
    return a;
  }, {});
};

function mergeFn(a, b) {
  return function () {
    a && a.apply(this, arguments);
    b && b.apply(this, arguments);
  };
}