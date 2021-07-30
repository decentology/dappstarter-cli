"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localDevleopment = exports.keygen = exports.clean = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = require("fs-extra");
const got_1 = __importDefault(require("got"));
const constants_1 = require("./constants");
const ssh_1 = require("./ssh");
async function clean({ homeConfigDir, projectName, authKey, }) {
    await cleanRemote(projectName, authKey);
    if (fs_extra_1.pathExists(homeConfigDir)) {
        await fs_extra_1.remove(homeConfigDir);
    }
    console.log(chalk_1.default.blueBright('[CONFIG] Configuration cleaned'));
}
exports.clean = clean;
async function cleanRemote(projectName, authKey) {
    const remoteStartResponse = await got_1.default(`${constants_1.SERVICE_URL}/system/clean`, {
        method: 'POST',
        retry: {
            limit: 2,
            methods: ['GET', 'POST'],
        },
        timeout: constants_1.REQUEST_TIMEOUT,
        headers: {
            Authorization: `bearer ${authKey}`,
        },
        json: {
            projectName,
        },
    });
}
async function keygen() {
    // Get GeneratedKeys
    const { publicSSH_key } = ssh_1.generateKeys();
    console.log(publicSSH_key);
}
exports.keygen = keygen;
async function localDevleopment() {
}
exports.localDevleopment = localDevleopment;
//# sourceMappingURL=develop.subcommands.js.map