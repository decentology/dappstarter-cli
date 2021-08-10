"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPaths = exports.setPorts = exports.setServiceUrl = exports.PORTS = exports.SERVICE_URL = exports.CONFIG_FILE = exports.REQUEST_TIMEOUT = void 0;
const os_1 = require("os");
const path_1 = require("path");
const string_hash_1 = __importDefault(require("string-hash"));
exports.REQUEST_TIMEOUT = 10 * 1000;
exports.CONFIG_FILE = 'config.json';
exports.SERVICE_URL = process.env.DAPPSTARTER_SERVICE_URL ||
    'https://dappstarter-api.decentology.com';
exports.PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];
function setServiceUrl(url) {
    process.env.DAPPSTARTER_SERVICE_URL = url;
    exports.SERVICE_URL = url;
}
exports.setServiceUrl = setServiceUrl;
function setPorts(ports) {
    exports.PORTS = ports;
}
exports.setPorts = setPorts;
function initPaths(inputDirectory) {
    const folderPath = inputDirectory || process.cwd();
    const rootFolderName = path_1.basename(folderPath);
    const hashFolderPath = string_hash_1.default(folderPath);
    const projectName = `${rootFolderName}-${hashFolderPath}`;
    const homeConfigDir = path_1.join(os_1.homedir(), '.dappstarter', projectName);
    const configFilePath = path_1.join(homeConfigDir, exports.CONFIG_FILE);
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