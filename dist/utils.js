"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionSearch = exports.log = exports.setLogLevel = void 0;
let DEBUG_ENABLED = false;
function setLogLevel(level) {
    DEBUG_ENABLED = level;
}
exports.setLogLevel = setLogLevel;
function log(msg) {
    if (DEBUG_ENABLED) {
        console.log(msg);
    }
}
exports.log = log;
function optionSearch(obj, property) {
    if (obj?.hasOwnProperty(property)) {
        return obj[property];
    }
    if (obj?.hasOwnProperty('parent')) {
        return optionSearch(obj.parent, property);
    }
    return null;
}
exports.optionSearch = optionSearch;
//# sourceMappingURL=utils.js.map