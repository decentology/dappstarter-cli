"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfiguration = exports.storeConfigurationFile = exports.checkLocalFileConfiguration = void 0;
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const js_yaml_1 = __importDefault(require("js-yaml"));
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const chalk_1 = __importDefault(require("chalk"));
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
            (0, constants_1.setPorts)(config.ports);
        }
        if (config?.hasOwnProperty('publicUrlEnabled')) {
            (0, constants_1.setPublicUrlEnabled)(config.publicUrlEnabled);
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