"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfiguration = exports.storeConfigurationFile = exports.checkLocalFileConfiguration = exports.initPaths = exports.setPublicUrlEnabled = exports.setCustomPorts = exports.setPorts = exports.setServiceUrl = exports.PUBLIC_URL_ENABLED = exports.CUSTOM_PORTS = exports.PORTS = exports.SERVICE_URL = exports.CONFIG_FILE = exports.REQUEST_TIMEOUT = void 0;
const fs_extra_1 = require("fs-extra");
const js_yaml_1 = __importDefault(require("js-yaml"));
const utils_1 = require("./utils");
const chalk_1 = __importDefault(require("chalk"));
const os_1 = require("os");
const path_1 = require("path");
const string_hash_1 = __importDefault(require("string-hash"));
exports.REQUEST_TIMEOUT = 10 * 1000;
exports.CONFIG_FILE = 'config.json';
exports.SERVICE_URL = process.env.DAPPSTARTER_SERVICE_URL ||
    'https://dappstarter-api.decentology.com';
exports.PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];
exports.CUSTOM_PORTS = false;
exports.PUBLIC_URL_ENABLED = true;
function setServiceUrl(url) {
    process.env.DAPPSTARTER_SERVICE_URL = url;
    exports.SERVICE_URL = url;
}
exports.setServiceUrl = setServiceUrl;
function setPorts(ports) {
    exports.PORTS = ports;
    exports.CUSTOM_PORTS = true;
}
exports.setPorts = setPorts;
function setCustomPorts(value) {
    exports.CUSTOM_PORTS = value;
}
exports.setCustomPorts = setCustomPorts;
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
const FILE_NAMES = [
    '.dappstarter/dappstarter.yml',
    '.dappstarter/dappstarter.yaml',
    '.dappstarter',
    '.dappstarter.yml',
    '.dappstarter.yaml',
    'dappstarter.yml',
    'dappstarter.yaml',
];
async function findConfigFiles(cwd) {
    const files = await Promise.all(FILE_NAMES.map(async (fileName) => {
        const filePath = (0, path_1.join)(cwd, fileName);
        const exists = await (0, fs_extra_1.pathExists)(filePath);
        return exists ? filePath : null;
    }));
    return files.filter(Boolean);
}
async function checkLocalFileConfiguration(folderPath) {
    const foundFiles = await findConfigFiles(folderPath);
    if (foundFiles.length > 1) {
        console.log(chalk_1.default.yellow(`[WARNING] Found multiple config files: ${foundFiles.join(', ')}. Using ${foundFiles[0]}`));
    }
    if (foundFiles.length > 0) {
        const config = js_yaml_1.default.load(await (0, fs_extra_1.readFile)(foundFiles[0], 'utf8'));
        if (config?.ports && config.ports.length > 0) {
            setPorts(config.ports);
        }
        if (config?.hasOwnProperty('publicUrlEnabled')) {
            setPublicUrlEnabled(config.publicUrlEnabled);
        }
        return config;
    }
    return null;
}
exports.checkLocalFileConfiguration = checkLocalFileConfiguration;
async function storeConfigurationFile(filePath, config) {
    await (0, fs_extra_1.writeJSON)(filePath, config, { spaces: 4 });
    (0, utils_1.log)(chalk_1.default.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}
exports.storeConfigurationFile = storeConfigurationFile;
async function getConfiguration(filePath) {
    const { projectUrl } = await (0, fs_extra_1.readJSON)((0, path_1.join)(filePath, 'config.json'));
    const privateKey = await (0, fs_extra_1.readFile)((0, path_1.join)(filePath, 'privatekey'), 'utf8');
    const publicKey = await (0, fs_extra_1.readFile)((0, path_1.join)(filePath, 'publickey'), 'utf8');
    return {
        projectUrl,
        privateKey,
        publicKey,
    };
}
exports.getConfiguration = getConfiguration;
//# sourceMappingURL=config.js.map