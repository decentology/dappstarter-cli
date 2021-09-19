"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPaths = exports.setPublicUrlEnabled = exports.setPorts = exports.setServiceUrl = exports.PUBLIC_URL_ENABLED = exports.PORTS = exports.SERVICE_URL = exports.CONFIG_FILE = exports.REQUEST_TIMEOUT = void 0;
const os_1 = require("os");
const path_1 = require("path");
const string_hash_1 = __importDefault(require("string-hash"));
exports.REQUEST_TIMEOUT = 10 * 1000;
exports.CONFIG_FILE = 'config.json';
exports.SERVICE_URL = process.env.DAPPSTARTER_SERVICE_URL ||
    'https://dappstarter-api.decentology.com';
exports.PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];
exports.PUBLIC_URL_ENABLED = true;
function setServiceUrl(url) {
    process.env.DAPPSTARTER_SERVICE_URL = url;
    exports.SERVICE_URL = url;
}
exports.setServiceUrl = setServiceUrl;
function setPorts(ports) {
    exports.PORTS = ports;
}
exports.setPorts = setPorts;
function setPublicUrlEnabled(value) {
    exports.PUBLIC_URL_ENABLED = value;
}
exports.setPublicUrlEnabled = setPublicUrlEnabled;
function initPaths(inputDirectory) {
    const folderPath = inputDirectory || process.cwd();
    const rootFolderName = (0, path_1.basename)(folderPath);
    const hashFolderPath = (0, string_hash_1.default)(folderPath);
    const projectName = `${rootFolderName}-${hashFolderPath}`;
    const homeConfigDir = (0, path_1.join)((0, os_1.homedir)(), '.dappstarter', projectName);
    const configFilePath = (0, path_1.join)(homeConfigDir, exports.CONFIG_FILE);
    return {
        folderPath,
        rootFolderName,
        hashFolderPath,
        projectName,
        homeConfigDir,
        configFilePath,
    };
}
exports.initPaths = initPaths;
//# sourceMappingURL=constants.js.map