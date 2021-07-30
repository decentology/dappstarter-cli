"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.setLogLevel = void 0;
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
//# sourceMappingURL=utils.js.map