import {isEmptyObj, parseString, getDomElem, isError} from "./lib.mjs"

export class easyTemplater {

  constructor() {
    this._resetCnt();
  }

  _resetCnt() {
    this.tagsCnt = {};
    this.attrCnt = {};
  }

  _cntAdd(cntName, val) {
    this[cntName][val] = this[cntName][val] == undefined ? 1 : ++this[cntName][val];
  }

  _checkPosition(pos, cntName, val) {
    if (pos != null && pos.indexOf(this[cntName][val]) == -1)
      return false;
    return true;
  }

  _processTags(nodes, sets) {
    for (let elem of nodes.childNodes) {
      if (elem.nodeName == "#text")
        continue;

      this._cntAdd("tagsCnt", elem.localName); // count position of this "elem.localName"

      let headers = "tag,attr";
      for (let setTag of sets) {   // we should process only known "headers"
        let str = "";
        parseString(headers, ",",
          (substr) => {
            if (setTag.getAttribute(substr)) {
              str = substr;
              return false; // stop search deeper if found already
            }
        });

        if (str.length == 0) // no known headers
          continue;

        let pos = setTag.getAttribute("pos"); // we look position in string. So you can can give any string like "1,2,3" or "1 2 3"

        if (str == "tag") {
          if (setTag.getAttribute(str).trim() != elem.localName)
            continue;

          if (!this._checkPosition(pos, "tagsCnt", elem.localName))
            continue;

          // set innerHTML
          if (setTag.innerHTML.length > 0)
          elem.innerHTML = setTag.innerHTML;

          // set attributes for "tag"
          let innerMarks = headers+",pos";
          for (let attr of setTag.attributes) {
            if (innerMarks.indexOf(attr.localName) != -1)
              continue;

            if (attr.nodeValue.length > 0)
              elem.setAttribute(attr.localName, attr.nodeValue);
          }
        }

        if (str == "attr") {
          let attrName = setTag.getAttribute("attr").trim();

          if (elem.getAttribute(attrName)) // count position of this "attrName"
            this._cntAdd("attrCnt", attrName);

          if (!this._checkPosition(pos, "attrCnt", attrName))
            continue;

          elem.setAttribute(attrName, setTag.innerHTML);
        }
      }

      if (!isEmptyObj(elem.childNodes)) // go deep into jungle..
        this._processTags(elem, sets);
    }
  }

  _processInnerHtml(srcElem, distElem) { // , attr
    let setArr = [];

    for (let node of distElem.children) // looking for "set" tags
      if (node.localName == "set")
        setArr.push(node);

    if (setArr.length == 0) { // no <set> found, just paste innerHTML to dist
      distElem.innerHTML = srcElem.innerHTML;
      return;
    }

    let srcCopy = srcElem.cloneNode(true); // should make a copy of src!
    this._resetCnt();
    this._processTags(srcCopy, setArr);       // make changes in copy!
    distElem.innerHTML = srcCopy.innerHTML;   // set changed in copy innerHTML
  }

  _parseTemplate(srcElem, param) { // param is {"dist": distElem, "template": template} . srcElem we got from "getDomElem"
    let val;
    if (param.template.length == 0) { // it can be a mistake, or we can have parent template "copy-template"
      val = srcElem.getAttribute("copy-template"); // "null" if not found
      if (val == null)
        return false;

      this._parseTemplate(srcElem, {"dist": param.dist ,"template": val});
      return true;
    }
    // parsing template string
    parseString(param.template, ",",
      (attr) => { // process attributes here
        if (attr == "innerHTML") { // this special case. we can have "set" tags inside
          this._processInnerHtml(srcElem, param.dist); //, attr
          return true;
        }

        if (srcElem[attr] != undefined) { // standart html variable like "className"
          param.dist[attr] += " "+srcElem[attr];
          return true;
        }

        val = srcElem.getAttribute(attr); // check src attribute
        if (!val)
          return false;

        if (attr == "copy-template") { // if have special attr "copy-template" inside list of attr
          this._parseTemplate(srcElem, {"dist": param.dist ,"template": val});
          return true;
        }

        param.dist.setAttribute(attr, val);
      }
    );
  }

  // template should be "id_of_source: htmlatr1, htmlatr2, htmlatr3"  htmlatr1..3 - real attr names like "innerHTML", "className"
  _processTemplate(tempStr, distElem) {
    let pos = tempStr.indexOf(":"); // get source elem "id" string
    let id = pos == -1 ? tempStr : tempStr.slice(0, pos).trim();
    let template = pos == -1 ? "" : tempStr.slice(pos+1);

    let res = getDomElem("getElementById", id, this._parseTemplate.bind(this), {"dist": distElem, "template": template}, true);
    if (isError(res))
      throw res; // ?
  }

  /******************************************************
  Api
  ******************************************************/

  copyFrom() {
    let attr = "copy-from";
    getDomElem("querySelectorAll", "["+attr+"]",
      (distElem, attr) => {
        this._processTemplate(distElem.getAttribute(attr), distElem);
      }, attr, false);
  }
}
