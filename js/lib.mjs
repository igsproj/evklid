// Common lib

export function isError(res) {
  return (res != undefined && res.constructor.name == "Error") ? true : false;
}

export function isEmptyObj(obj) {
  if (typeof(obj) != "object" || obj == null || obj == undefined || obj == NaN)
    return true;

  if (Array.isArray(obj) && obj.length == 0)
    return true;

  for (let key in obj)
    return false;

  return true;
}

export function parseString(str, del, cb, cbArg, trim = true) {
  let pos = -1;
  let start = 0;

  let t = function (s, trim) {
    return trim === true ? s.trim() : s;
  }

  while ((pos = str.indexOf(del, pos + 1)) != -1) {
    if (cb(t(str.slice(start, pos), trim), cbArg) === false)
      return false;
    start = pos + 1;
  }

  if (str.length > start) {
    pos = str.length;
    if (cb(t(str.slice(start, pos), trim), cbArg) === false)
      return false;
  }
  return true;
}

export function getObjChild(elem, path) {
  let cont = "";
  let res = elem;

  if (isEmptyObj(elem))
    return undefined;

  parseString(path, ".",
  (substr) => {
    cont = substr.trim();
    if (res[cont] == undefined){
      res = undefined;
      return false;
    }
    res = res[cont];
    return true;
  });

  return res;
}

export function writeObjValues(obj, newObj, rewrite = false) {
  if ((rewrite == false) && (isEmptyObj(obj) || isEmptyObj(newObj)))
    return false; // throw ?

  let src = rewrite == true ? newObj : obj;

  let res = false;
  for (let key in src)
    if ((newObj[key] != undefined && rewrite == false) || rewrite == true) {
      obj[key] = newObj[key];
      res = true;
    }

  return res;
}

export function getDomElem(domFunc, query, cbFunc, cbParam, singleElem) {
  query = query.trim();
  domFunc = domFunc.trim();

  if (typeof(document[domFunc]) != "function")
    return new Error("getDomElem: DOM function '"+domFunc+" not found");

  let found = document[domFunc](query);

  if ((singleElem && found == null) || (!singleElem && found.length == 0))
    return new Error("getDomElem: DOM function '"+domFunc+"("+query+") / element(s) not found");

  if (typeof(cbFunc) != "function")
    return found; // TODO ?

  // if have a callback function to process each found elem
  let cnt = 1;
  if (found.length != undefined) // array of elements
    cnt = found.length;

  for (let i = 0; i < cnt; ++i) {
    let elem = found.length != undefined ? found[i] : found;
    let res = cbFunc(elem, cbParam);
    if (isError(res))
      return res;
  }
}

export function select(elem, clean = true) {
  if (!elem)
    return;
  if (clean)
    elem.value = "";
  elem.focus();
  elem.select();
}

export function changeClassList(elem, classStr, fname, del = " ") {
  parseString(classStr, del,
  (substr, fname) => {
    let c = substr.trim();
    if (c.length > 0)
        elem.classList[fname](c);
  }, fname);
}

export function changeClassListByAttrib(attrib, elem, fname, del = " ") {
  let classStr = elem.getAttribute(attrib);
  if (classStr)
    changeClassList(elem, classStr, fname);
}

export function checkArgs(arg, types) {
  if (arg == undefined || types == undefined)
    throw new Error("checkArgs: arg / types are undefined");

  if ((arg.length / types.length) != 2)
    throw new Error("checkArgs: args="+arg.length+" types="+types.length);

  for (let i = 0; i < types.length; ++i) {
    try {
      let conName = arg[i].constructor.name;
    }
    catch(ex) {
      throw new Error("checkArgs: arg="+i+" is not defined");
    }

    if (arg[i].constructor.name != types[i])
      throw new Error("checkArgs: arg="+i+" should be type of '"+types[i]+"' but it's '"+arg[i].constructor.name)+"'";
  }
}



