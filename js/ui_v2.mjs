import * as lib from "./lib.mjs"

export let defAlg = [ {"func": "changeActiveClass"}, {"func": "changeTabStyleSimple"}];

export let nameMap = {
  "selectAttrName": "selected",
  "dataSlaveAttrName": "data-dist",
  "activeAttrName": "active", // class using for "active state"
  "statusAttrName": "winstatus",
  "ffcontrolAttrName": "ffcontrol",
  "nameAttrName": "itemname",
  "winAttrName": "winname",
  "winAttrOpen": "opened",
  "winAttrClose": "closed",
}

export class winController {

  constructor() {
    this.winList = {};
    /*
    possible types :
    "master" - opens without any conditions - no control at all
    "modal" - opens if no other modals active and nothing can be opened if modal is active (except master)
    "normal" - opens only if no "modal" active
    "slave" - same as "normal", but has additional "owner" dependings
    */
    this.types = ["modal","master","normal","slave"];
    this.winStack = []; // store open windows in LIFO
  }

  /******************************************************
  Internal functions
  ******************************************************/

  _getWindowAttr(winName, path) { // returns null if no window found, undefined if no attr found
    let win = this.getWindow(winName);
    if (win == undefined)
      return null;
    return lib.getObjChild(win, path);
  }

  _runExecutor(curWin, status) {
    curWin.statuses.current = status; // first change status
    curWin.statuses[status]._exec(0, false); // try to run callback for this status
  }

  _statusOpen(winName, curWin, newStatus) {
    // console.log(winName+".open() type="+curWin.type);
    let rejected = false;
    if (curWin.type != "master") // do not process any conditions in "master"
      for (let win in this.winList) {  // search for conditions depending on "curWin.type" check other windows
        if (win == winName || this.getWindowStatus(win) != nameMap.winAttrOpen) // same window or not opened
          continue;

        if (this.getWindowType(win) == "modal")  // have another open modal window
          rejected = true;

        if (curWin.type == "slave" && curWin.owners.indexOf(win) != -1) // opened owner for slave
          rejected = true;

        if (rejected) {
          //console.log("rejected to open window '"+winName+"' of type '"+curWin.type+"' because already opened '"+win+"'");
          return false;
        }
      }
    this._runExecutor(curWin, newStatus);
    return true;
  }

  _statusClose(winName, curWin, newStatus) {
    // console.log(winName+".close()");
    this._runExecutor(curWin, newStatus);
    return true;
  }

  _setFunc(winName, fname, func) {
    let win = this.getWindow(winName);
    if (typeof(func) != "function" || win == null || win[fname] == undefined)
      return null;
    win[fname] = func;
    return true;
  }

  /******************************************************
  External functions
  ******************************************************/

  add(winObj) {
    let winName = winObj.name;
    if (winName == undefined)
      return false;

    if (this.winList[winName] == undefined) { // first time
      this.winList[winName] = winName;    // add key with name. name always unique
      this.winList[winName] = {"name": winName};
      this.winList[winName].type = "normal";
      this.winList[winName].owners = "";
      this.winList[winName].close = () => {console.log("close stub for '"+winName+"'")};
      this.winList[winName].open = () => {console.log("open stub for '"+winName+"'")};
      this.winList[winName].statuses = {"current": null};  // statuses processing
      this.winList[winName].statuses[nameMap.winAttrOpen] = new linearExecuter();  // callbacks for open status
      this.winList[winName].statuses[nameMap.winAttrClose] = new linearExecuter(); // callbacks for close status
    }
    lib.writeObjValues(this.winList[winName], winObj); // rewrite settings by user
    return true;
  }

  setCloseFunc(winName, func) {
    return this._setFunc(winName, "close", func);
  }

  setOpenFunc(winName, func) {
    return this._setFunc(winName, "open", func);
  }

  addExternalCb(winName, execObj, status) {
    let win = this.getWindow(winName);
    if (!win)
      return false;

    win.statuses[status].add(execObj); // if pass empty "execObj" will get exeption
    return true;
  }

  getWindow(winName) { // "undefined" if no window
    return this.winList[winName];
  }

  getWindowStatus(winName) {
    return this._getWindowAttr(winName, "statuses.current");
  }

  getWindowType(winName) {
    return this._getWindowAttr(winName, "type");
  }

  closeWindow(winName) {
    let status = this.getWindowStatus(winName);
    if (status != null && status == nameMap.winAttrOpen)
      this.getWindow(winName).close();
  }

  setOpenCloseForTrigger(winName, cl)  {
    this.setCloseFunc(winName, () => {cl.first()});           // set close function for "search-win"
    this.setOpenFunc(winName, () => {cl.last()});             // set open function for "search-win"
  }

  winProcess(elem) { // elem is DOM object with attribute "winAttrName", "statusAttrName", "windowAttrOpen" in HTML

    let winName = elem.getAttribute(nameMap.winAttrName);
    if (winName == null)
      throw new Error("winController.open: can't find attribute for window name '"+winName+"'");

    // if (this.winList[winName] == undefined) // getting the window
    //   throw new Error("winController.open: window is not defined '"+winName+"'");

    let curWin = this.getWindow(winName);  //this.winList[winName];
    if (!curWin)
      throw new Error("winController.open: window '"+winName+"' is not defined");

    let newStatus = elem.getAttribute(nameMap.statusAttrName);

    // console.log(winName+" "+curWin.statuses.current+"->"+newStatus); // debug
    // if (newStatus == curWin.statuses.current) {
    if (newStatus == this.getWindowStatus(curWin)) {
      //console.log("same status ?"); // debug
      return true;
    }

    // console.log(newStatus);

    if (newStatus == nameMap.winAttrOpen) {
      this.winStack.push(curWin); // add to stack
      // console.log(this.winStack);
      return this._statusOpen(winName, curWin, newStatus);
    }

    if (newStatus == nameMap.winAttrClose) {
      let found = this.winStack.indexOf(curWin);
      if (found != -1)
        this.winStack.splice(found, 1);

      // console.log(this.winStack);
      // console.log(found);
      return this._statusClose(winName, curWin, newStatus);
    }

    return true;
  }

  closeLastOpened() {
    let win = this.winStack[this.winStack.length - 1];
    if (!lib.isEmptyObj(win)) {
      this.closeWindow(win.name);
      // console.log(this.winStack);
    }
  }
}

export class controlList {

  constructor(className, stNew, execArr = defAlg) {
    this.className = className;
    this.execArr = execArr;
    this.cList = {"default": null, "selected": null, "index": -1, "items": []};
    this.execExtCbBegin = []; // array of external binded functions - runs on begin
    this.execExtCbEnd = [];   // array of external binded functions - runs on end
    this.curEvent = null;
    this.st = {
      "defaultActions": ["click"],
      "mode": "singleSelect",  // possible values : "singleSelect", "singleSelectHybrid", "multiSelect" , "triggerSelect"
      "baseControlFuncName": "_baseControlAlg",
      "loopForward": true,
      "loopBackward": false,
      "triggerDirection": "forward",  // process trigger in _defaultTrigger : "forward" - using "next", "backward" - using "prev"
      "runBeginCb": true,
      "runEndCb": true,
    };

    lib.writeObjValues(this.st, stNew);
    this.controlFunc = this[this.st.baseControlFuncName].bind(this);
    this._createControlList();
  }

  // execArrChange(func, value) {
  //   this.execArr[func](value);
  // }

  // rewriteSt(stNew) {
  //   lib.writeObjValues(this.st, stNew);
  // }

  // rewriteExec(execArr) {
  //   this.execArr = execArr;
  // }

  /******************************************************
  Internal functions
  ******************************************************/

  _bindDefaultActions(elem) {
    if (elem.getAttribute(nameMap.selectAttrName) != null)
      this.cList.default = elem;

    this.cList.items.push(
      {
        "name": elem.getAttribute(nameMap.nameAttrName),
        "item": elem,
      });

    for (let act of this.st.defaultActions)
      elem.addEventListener(act, (ev) => {
        this.curEvent = ev;
        this.actFunc(ev);
        this.curEvent = null;
      });
  }

  _createControlList() {

    if (this.st.mode == "triggerSelect")
      this.actFunc = () => {this._defaultTrigger()};
    else
      this.actFunc = (ev) => {this._onActive(ev.currentTarget)};

    let res = lib.getDomElem("getElementsByClassName", this.className, (elem) => {this._bindDefaultActions(elem)}, false, false);

    if (lib.isError(res))
      throw res;

    if (this.cList.default) // selected in HTML
      this._onActive(this.cList.default); // select default item (if have)
  }

  _execExtFunc(arr, elem, fname) {
    if (!Array.isArray(arr))
      return false;

    let res;
    for (let i = 0; i < arr.length; ++i) {

      if (arr[i].type == "onEvent") // run function only if triggered this.curEvent
        if (this.curEvent == null ) //|| arr[i].condition != this.curEvent
          continue;

      let t = typeof(arr[i].func);

      if (t == "string") // inner function of object (by name)
        res = this[arr[i].func](elem, fname);

      if (t == "function") // external cb function
        res = arr[i].func(elem);

      // console.log(arr[i]);
      // console.log(res);
      if (res === false) // when need to stop processing - function just should return "false"
        return false;
    }
    return true;
  }

  _setFunc(elem) {
    let func = ["remove","add"]; // Also used in "triggerSelect"

    if ((this.getMode() == "singleSelectHybrid" && elem == this.getSelected()) || (this.getMode() == "multiSelect"))
      func = ["toggle"];

    if (this.getMode() == "singleSelect" && elem == this.getSelected())  // Do not allow click on same elem in "singleSelect" mode
      func = [];

    return func;
  }

  _baseControlAlg(currentTarget) {
    let func = this._setFunc(currentTarget);
    for (let i = 0; i < func.length; ++i) {
      let elem = this.getMode() == "multiSelect" ? currentTarget : this.getSelected();

      // console.log(elem);

      if (elem) // possible ?
        if (this._execExtFunc(this.execArr, elem, func[i]) === false)
          return;

      this.setSelected(currentTarget); // TODO for multiselect : if need to store selected items ?
    }
  }

  _onActive(currentTarget) { // standart click behavior

    // if (this.curEvent != null)
    //   console.log("interactive");
    
    if (this.st.runBeginCb) {  // run begin callbacks
      // console.log("_onActive run begin cb:");
      if (this._execExtFunc(this.execExtCbBegin, currentTarget, null) === false) // false - break the chain!
        return;
    }

    this.controlFunc(currentTarget);

    if (this.st.runEndCb) { // run end callbacks
      // console.log("_onActive run end cb:");
      this._execExtFunc(this.execExtCbEnd, currentTarget, null);
    }
  }

  _defaultTrigger() {
    if (this.st.triggerDirection == "forward")
      this.next();
    if (this.st.triggerDirection == "backward")
      this.prev();
  }

  _shift(pos, op) {
    let sh = pos == undefined ? 1 : pos;

    if (op == "-")
      sh = 0 - sh;

    let start = op == "=" ? 0 : this.getIndex();
    let elem = this.getItems()[start + sh].item;

    if (elem == undefined)
      return new Error("controlList._shift elem with start="+start+" shift="+sh+" not found");

    this._onActive(elem);
    return true;
  }

  _isFirst() {
    return this.getIndex() == 0 ? true : false;
  }

  _isLast() {
    return this.getIndex() != this.getLastIndex() ? false : true;
  }

  _loopFw() {
    if (this.st.loopForward && this._isLast()) {
      this.first();
      return true;
    }
    return false;
  }

  _loopBw() {
    if (this.st.loopBackward && this._isFirst()) {
      this.last();
      return true;
    }
    return false;
  }

  // _findInList(value, cb) {

  //   let res = null;
  //   for (let i = 0; i < this.cList.items.length; ++i) {
  //     res = cb(value, this.cList.items[i]);
  //     if (res)
  //       return res;
  //   }
  //   return res;
  // }

  /******************************************************
  External functions
  ******************************************************/

  setChange(item, val) { // if not found creates new "item"
    this.st[item] = val;
  }

  getMode() { //"singleSelect", "singleSelectHybrid", "multiSelect" , "triggerSelect"
    return this.st.mode.trim();
  }

  getItems() {
    return this.cList.items;
  }

  getIndex() {
    return this.cList.index;
  }

  getByName(itemName) {
    let res = this.getItems().find(listItem => listItem.name == itemName);
    return lib.getObjChild(res, "item");

    // return this._findInList(itemName,
    //   (itemName, listItem) => {
    //     if (itemName == listItem.name)
    //       return listItem.item;
    //   });
  }

  getLastIndex() {
    return this.cList.items.length-1;
  }

  getSelected() {
    return this.cList.selected;
  }

  setSelected(elem) {
    if (elem == undefined)
      return;

    this.cList.selected = elem;
    this.getItems().find(
      (listItem, index) => {
        if (listItem.item == elem) {
          this.cList.index = index;
          // console.log("index ="+index);
          return true;
        }
      });

    // console.log(this.cList.selected);
    // let index = 0;
    // this._findInList(elem,
    //   (elem, listItem) => {
    //     if (listItem.item == elem) {
    //       this.cList.index = index;
    //       // console.log("index ="+index);
    //       return true;
    //     }
    //     ++index;
    //   });
  }

  first() {
    if (!this._isFirst()) {
      this._onActive(this.getItems()[0].item);
      return true;
    }
    return false;
  }

  last() {
    if (!this._isLast()) {
      this._onActive(this.getItems()[this.getLastIndex()].item);
      return true;
    }
    return false;
  }

  next(pos) { // walk begin to end
    if (!this._loopFw())
      return this._shift(pos, "+");
  }

  prev(pos) { // walk end to begin
    if (!this._loopBw())
      return this._shift(pos, "-");
  }

  jump(pos) { // jump to index
    return this._shift(pos, "=");
  }

  /*******************************************************************
  additional functions for onActive - you can write your own!
  *******************************************************************/

  // calls "fname" for every classname found in string "classStr"
  changeActiveClass(elem, fname) { // TODO
    lib.changeClassListByAttrib(nameMap.activeAttrName, elem, fname);
  }

  // Just changes "active" class of element and its "data-dist"
  changeTabStyleSimple(elem, func) {
    lib.getDomElem("querySelectorAll", "["+nameMap.dataSlaveAttrName+"="+elem.dataset.path+"]", this.changeActiveClass, func, false);
  }

  // cbtype : cbtype "onevent",
  addExternalCb(func, type, where = "onBegin") {
    if (typeof(func) == "function") {
      let newFunc = {"func": func, "type": type};
      if (where == "onBegin")
        this.execExtCbBegin.push(newFunc);
      if (where == "onEnd")
        this.execExtCbEnd.push(newFunc);
      return true;
    }
    return false;
  }
}

/*******************************************************************
simple linear functions executer (from begin to end of array "this.ca"). If set delay for elem, waits before exec next func

  itemObj should be:
  {
    func: <name of your function>
    arg: <function params : object>
    delay: <time in Ms we wait before exec>
  }
*******************************************************************/

export class linearExecuter {

  constructor() {
    this.ca = [];
    this.stopFlag = true;
    this.index = 0;
    this.timer = 0;  // we have one timer for all elems! because this is linear alg : we call functions one by one
    this.loop = -1;  // if 0 - then continue inf, if loop > 0 -> repeat loop times; if < 0 - nothing
    this.execCnt = 0;

    // this.template = { // TODO
    //   "func": "function",
    //   "arg": "object",
    //   "delay": "number"  // Ms
    //   "stopIfFailed": true
    // }
  }

  /******************************************************
  Internal functions
  ******************************************************/

  _runFunc(cont) { // passing context to function
    //console.log(cont);
    let elem = cont.ca[cont.index];
    let res = elem.func(elem.arg);     // run current func
    if (elem.onError != undefined && lib.isError(res)) {
      if (elem.onError == "stopAndLog") {
        this.stop();
        console.log("Error: "+res);
        return; // if any other params
      }

      if (elem.onError == "log")
        console.log("Error: "+res);

      if (elem.onError == "stopAndExc") {
        this.stop();
        throw res;
      }
    }
    cont._exec(++cont.index); // run next func
  }

  _exec(i, loopControl = true) {
    if (loopControl && (this.stopFlag || this.loop < 0))
      return;

    if (this.ca.length == 0) { // debug
      // console.log("linearExecuter.exec: nothing to execute!");
      return;
    }

    this.index = i == undefined ? 0 : i;
    if (this.index >= this.ca.length) { // end executing of one loop
      ++this.execCnt;
      if ((this.loop == 0) || (this.loop > 0 && this.execCnt < this.loop)) // continue from begin
        this.restart(false); // do not reset "execCnt" when this.restart(false)
      return;
    }

    let elem = this.ca[this.index];
    // console.log("run : "+elem.func);

    if (elem.delay > 0 && elem.noDelayOn != this.execCnt)
      this.timer = setTimeout(this._runFunc.bind(this), elem.delay, this);
    else
      this._runFunc(this);
  }

  /******************************************************
  External functions
  ******************************************************/

  setLoop(loop) {
    this.loop = loop;
  }

  add(itemObj) {
    if (lib.isEmptyObj(itemObj))
      throw new Error("commandArray.add: can't add empty object");
    // TODO should check template before add here ?
    this.ca.push(itemObj);
  }

  stop() {
    if (!this.stopFlag) {
      this.stopFlag = true;
      clearTimeout(this.timer);
    }
  }

  restart(resetExecCnt = true) { // starts from begin of alg array
    this.stop();
    this.stopFlag = false;
    this.index = 0;
    if (resetExecCnt)
      this.execCnt = 0;
    this._exec(0);
  }
}

export class controlListChanger {

  constructor(className, stNew, execArr = defAlg) { // cl is a controlList object
    // let ca = function(a1, ...types) {
    //   lib.checkArgs(arguments, types);
    // }
    // ca(cl, "controlList"); // check argument type

    this.cl = new controlList(className, stNew, execArr);
    this.le = new linearExecuter();
    this.playStopControls = null; // controlList for play/stop - init in bindExternalControls
    this.moveControls = null;     // controlList for first,next,prev,last - init in bindExternalControls
    this.idleTimer = 0;

    this.st = {   // default inner settings
      "changeDelay": 2000,    // delay between activate next elem (Ms)
      "restartOnIdle": 10000, // if stopped, auto restart in this time (Ms)
      "algList": "bte",
      "loopDefault": 0, // default is infinity loop
    };

    this.ffControls = ["play", "stop", "first", "next", "prev", "last"]; // we expect this names in HTML attribute "ffcontrol"

  //  lib.writeObjValues(this.st, stNew);
    this._initPlay(stNew);
    this.cl.addExternalCb(
      () => { /*this.stop()*/
        //console.log("stop on event");
        //console.log(this.le.stopFlag);
        // if (this.le.stopFlag) // playback
        this.stop();
        if (this.playStopControls) // default it changes the button from "stop" to "play" (because we stop after move)
          this.playStopControls.first();

      }, "onEvent"); // we should always call "stop" for controlListChanger when click on "cl" items
  }

  /******************************************************
  Internal functions
  ******************************************************/

  _initPlay(stNew) {
    lib.writeObjValues(this.st, stNew); // we can start with new settings every new execution
    this.le.setLoop(this.st.loopDefault);
    this.le.ca = this._setupAlg();
  }

  _idleTimerRun() {
    if (this.le.stopFlag)
      this.play();
  }

  _idleTimerStart() {
    clearTimeout(this.idleTimer);
    if (this.st.restartOnIdle > 0 && this.le.loop >= 0)
      this.idleTimer = setTimeout(this._idleTimerRun.bind(this), this.st.restartOnIdle);
  }

  _getFunc(fname) {
    return this[fname].bind(this);
  }

  _setupAlg() {
    let res = [];
    lib.parseString(this.st.algList, ",",
      (substr) => {
        let fname = substr.trim();
        if (typeof(this[fname]) != "function")
          throw new Error("controlListChanger: _setupAlg '"+fname+"' is not a known function name");

        let alg = this[fname](); // get alg array from each func and copy to result array
        if (!Array.isArray(alg))
          throw new Error("controlListChanger: _setupAlg '"+fname+"' should return an array");

        for (let elem of alg)
          res.push(elem);
      }
    );
    return res;
  }

  _linearAlg(fname1, fname2, noFirstDelay, corr = 0) { // build in simple alg for walking "begin to end (bte)" or "end to begin (etb)"
    let res = [];
    for(let i = 0; i <= this.cl.getLastIndex()-corr; ++i)
      if (i == 0)
        res.push({
          "func": this._getFunc(fname1),
          "delay": (noFirstDelay && i == 0) ? 0 : this.st.changeDelay,
          "onError": "log"
        });
      else
        res.push({
          "func": this._getFunc(fname2),
          "delay": this.st.changeDelay,
          "onError": "log"
        })
    return res;
  }

  _jumper(posArr, noFirstDelay = true) {
    let res = [];
    for (let i = 0; i < posArr.length; ++i)
      res.push({
        "func": this._getFunc("jump"),
        "delay": (noFirstDelay && i == 0) ? 0 : this.st.changeDelay,
        "onError": "log",
        "arg": posArr[i]
      });
    return res;
  }

  /**************************************************************
  External functions
  **************************************************************/

  // functions for adding to alg. suggest : don't use them as controls directly, they don't stop playing. In most cases, use move(fname) instead
  first() {
    return this.cl.first();
  }

  last() {
    return this.cl.last();
  }

  next(pos) {
    return this.cl.next(pos);
  }

  prev(pos) {
    return this.cl.prev(pos);
  }

  jump(pos) {
    return this.cl.jump(pos);
  }

  move(fname) { // e.g move("first"), move("last"), move("next"), move("prev")
    this.stop();
    return this[fname]();
  }

  stop() {
    // console.log("stop");
    this.le.stop();
    this._idleTimerStart();
  }

  play(stNew) { // play can be rerun with new settings
    //if (!lib.isEmptyObj(stNew))
    this._initPlay(stNew);
    this.le.restart();
  }

  playStop(stNew) { // its trigger function : if play -> stop, if stop -> play
    if (this.le.stopFlag) // stopped
      this.play(stNew);
    else
      this.stop();
  }

  // builtin algorithms
  bte() { // begin to end : delay on first
    return this._linearAlg("first", "next", false);
  }

  bte_lf() { // bte that uses loop forward (no "first" command). Should be set up "loopForward": true
    let alg = this._linearAlg("next", "next", false);
    alg[0].noDelayOn = 0;
    return alg;
  }

  etb() { // end to begin : delay on first
    return this._linearAlg("last", "prev", false);
  }

  bte_nd() { // begin to end : no delay on first
    return this._linearAlg("first", "next", true);
  }

  etb_nd() { // end to begin : no delay on first
    return this._linearAlg("last", "prev", true);
  }

  // jumpers use real positions by index in command array - be careful!
  // test functions for 4 items
  jump_3142_nd() { // for list consists of 4 elem : go 3 -> 1 -> 4 ->2 with no first elem delay
    return this._jumper([2,0,3,1,2], true); // we use here real indexes ! 5 indexes, because first elem dont have delay, we use same index 2 at end.
  }

  // this func with delay on first
  jump_3142() {
    return this._jumper([2,0,3,1], false);
  }

  // binding of external controls panel (first,next,prev,stop,play,last)
  ffcontrolDefault(elem) {
    let control = elem.getAttribute(nameMap.ffcontrolAttrName);
    if (!control)
      return false;

    if (this.ffControls.indexOf(control) == -1) // TODO use string instead ?
      return false;

    if (control == "play" || control == "stop")
      this[control](); // for play/stop uses "play" and "stop" functions
    else {
      this.move(control);        // for movement we use "move", it calls "stop" first
      if (this.playStopControls) // default it changes the button from "stop" to "play" (because we stop after move)
        this.playStopControls.first();
    }
  }

  bindExternalControls(type, className, stNew, defAlg = [{"func": "changeActiveClass"}], cb = this._getFunc("ffcontrolDefault")) {
    if (type == "playStopControls" || type == "moveControls") {
      this[type] = new controlList(className, stNew, defAlg);
      this[type].addExternalCb(cb);
    }
  }
}
