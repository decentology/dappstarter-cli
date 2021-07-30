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
async function checkLocalFileConfiguration(folderPath) {
    const filename = 'dappstarter.yml';
    if (await fs_extra_1.pathExists(path_1.join(folderPath, filename))) {
        const config = js_yaml_1.default.load(await fs_extra_1.readFile(path_1.join(folderPath, filename), 'utf8'));
        ;
        if (config?.ports) {
            constants_1.setPorts(config.ports);
        }
        return config;
    }
}
exports.checkLocalFileConfiguration = checkLocalFileConfiguration;
async function storeConfigurationFile(filePath, config) {
    await fs_extra_1.writeJSON(filePath, config, { spaces: 4 });
    utils_1.log(chalk_1.default.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}
exports.storeConfigurationFile = storeConfigurationFile;
async function getConfiguration(filePath) {
    const { projectUrl } = await fs_extra_1.readJSON(path_1.join(filePath, 'config.json'));
    const privateKey = await fs_extra_1.readFile(path_1.join(filePath, 'privatekey'), 'utf8');
    const publicKey = await fs_extra_1.readFile(path_1.join(filePath, 'publickey'), 'utf8');
    return {
        projectUrl,
        privateKey,
        publicKey,
    };
}
exports.getConfiguration = getConfiguration;
//# sourceMappingURL=config.js.map