import * as ui from "./ui_v2.mjs";
import { easyTemplater } from "./tmpl.mjs";
import { getDomElem, select } from "./lib.mjs";

// templator: should be first!
new easyTemplater().copyFrom();

// windows
let wcon = new ui.winController();
let winProcess = wcon.winProcess.bind(wcon);
wcon.add({"name": "burger-win", "type": "normal"}); // HTML -> winname="burger-win"
wcon.add({"name": "search-win", "type": "normal"}); // HTML -> winname="search-win"

// find input for search window
let searchInput = null;
getDomElem("getElementById", "input-search-id", (elem) => {searchInput = elem}, null, true);

// inbox search button
let searchButton = null;
getDomElem("getElementById", "button-search-id", (elem) => {searchButton = elem}, null, true);

if (searchButton)
  searchButton.addEventListener('click', searchSite);

// burger menu buttons
let burger = new ui.controlList(
  "burger-control",
  {"mode": "triggerSelect", "loopForward": true, "loopBackward": true, "triggerDirection": "forward"},
);
burger.addExternalCb(winProcess, "", "onBegin");  // enable window processing
wcon.setOpenCloseForTrigger("burger-win", burger); // set open/close function for "burger-win"

let burgerOpen = burger.getByName("burger-open"); // bind "keyup" for open burger : we dont need use "Enter" to open it - in just "focus"
if (burgerOpen)
  burgerOpen.addEventListener("keyup", burger.actFunc);

// search buttons
let search = new ui.controlList(
  "search-control",
  {"mode": "triggerSelect", "loopForward": true},
);

search.addExternalCb(winProcess, "", "onBegin");  // enable window processing
search.addExternalCb(() => {setFocusForWindow(searchInput, "search-win")}, "", "onEnd");  // set callback for focus on input when open
wcon.setOpenCloseForTrigger("search-win", search);  // set open/close function for "search-win"
// it doesnt work with "setSearchFocus" because runs in "winProcess" (it starts onBegin) - so focus sets before window opened
//wcon.addExternalCb("search-win", {"func": setSearchFocus}, ui.nameMap.winAttrOpen);
let openSearchBox = search.getByName("open-search-box");
if (openSearchBox)
  openSearchBox.addEventListener("keyup", search.actFunc);

// menu items
let menu = new ui.controlList(
  "top-menu__nav-link",
  {"mode": "singleSelect"}
);
menu.addExternalCb((item) => {wcon.closeWindow("burger-win")}, "", "onEnd"); // set callback for clicking on menu items

// how we work
let steps = new ui.controlListChanger(
  "how-we-work__step",    // main class of control list
  {
    "changeDelay": 3000,
    "restartOnIdle": 0,
    "algList": "bte_lf",
    "loopDefault": 0,
    "loopForward": true,
    "loopBackward": true,
    "defaultActions": ["click", "keyup"],
  });

// this setup when we want play/stop triggered
steps.bindExternalControls( // bind play / stop controls
  "playStopControls",
  "ffplaystop-control", // class for play/stop buttons
  {"mode": "triggerSelect", "loopForward": true,} // we change button from play to stop in "loopForward" (because "play" is first in html)
);

steps.bindExternalControls( // bind move controls
  "moveControls",
  "ffmove-control", // class for movement buttons
);

// this setup when we want to have all control buttons near in one list.
// steps.bindExternalControls( // bind move controls
//   "moveControls",
//   "how-we-work__control",
// );

// faq
new ui.controlList(
  "faq__details", // main class of control list
  {
    "mode": "singleSelectHybrid", // you can try also : "singleSelect" "multiSelect"
    "defaultActions": ["click", "keyup"],
  }
);

//corousel
new ui.controlListChanger( // Uses default : "changeDelay": 2000, "restartOnIdle": 10000,
  "corousel__bullet", // main class of control list
  {
    "algList": "bte,etb",
    "loopDefault": 0, // infinity
    "defaultActions": ["click", "keyup"],
  }
).play(); // start corousel auto play

// keyboard process keys
window.addEventListener("keydown",
  (event) => {
    // console.log(`KeyboardEvent: key='${event.key}' | code='${event.code}'`);
    if (event.key == "Escape")
      wcon.closeLastOpened();

    if (event.key == "Enter") {
      if (searchInput && document.activeElement == searchInput)
        searchSite();
    }
  }, true);

// additional functions
function setFocusForWindow(winElem, winName) {
  if (wcon.getWindowStatus(winName) == ui.nameMap.winAttrOpen) // set focus only for opened window
    select(winElem, true);
}

function searchSite() {
  alert("Search is not ready yet!");
}

/*
TODO
stop when click in list
+actions "click", "keyup" binding
multiselect - store selected (same as active windows) ?
*/
