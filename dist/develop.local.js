"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const os_1 = require("os");
const string_hash_1 = __importDefault(require("string-hash"));
const constants_1 = require("./constants");
async function localCommand(subCommand, subCommandOption, command, options) {
    let folderPath = options?.inputDirectory || process.cwd();
    const rootFolderName = path_1.basename(folderPath);
    const hashFolderPath = string_hash_1.default(folderPath);
    const projectName = `${rootFolderName}-${hashFolderPath}`;
    const homeConfigDir = path_1.join(os_1.homedir(), '.dappstarter', projectName);
    const configFilePath = path_1.join(homeConfigDir, constants_1.CONFIG_FILE);
}
exports.default = localCommand;
//# sourceMappingURL=develop.local.js.map