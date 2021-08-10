"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localDevleopment = exports.keygen = exports.cleanAction = exports.downAction = exports.localDownAction = exports.localAction = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = require("fs-extra");
const got_1 = __importDefault(require("got"));
const constants_1 = require("./constants");
const ssh_1 = require("./ssh");
const os_1 = require("os");
const path_1 = require("path");
const auth_1 = __importDefault(require("./auth"));
const auth_2 = require("./auth");
const docker_1 = require("./docker");
const utils_1 = require("./utils");
async function localAction(command) {
    const inputDirectory = utils_1.optionSearch(command, 'inputDirectory');
    const { folderPath, homeConfigDir, projectName } = constants_1.initPaths(inputDirectory);
    await docker_1.startContainer(homeConfigDir, projectName, folderPath);
}
exports.localAction = localAction;
async function localDownAction(command) {
    const inputDirectory = utils_1.optionSearch(command, 'inputDirectory');
    const { homeConfigDir } = constants_1.initPaths(inputDirectory);
    await docker_1.stopContainer(homeConfigDir);
}
exports.localDownAction = localDownAction;
async function downAction(command) {
    const inputDirectory = utils_1.optionSearch(command, 'inputDirectory');
    const { projectName } = constants_1.initPaths(inputDirectory);
    if (!(await auth_2.isAuthenticated())) {
        await auth_1.default();
    }
    let authKey = (await fs_extra_1.readJson(path_1.join(os_1.homedir(), '.dappstarter', 'user.json'))).id_token;
    try {
        await got_1.default(`${constants_1.SERVICE_URL}/system/stop`, {
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
        console.log(chalk_1.default.blueBright(`Remote container has been stopped.`));
    }
    catch (error) {
        console.error(chalk_1.default.red(JSON.stringify(error)));
    }
}
exports.downAction = downAction;
async function cleanAction(command) {
    const inputDirectory = utils_1.optionSearch(command, 'inputDirectory');
    const { homeConfigDir, projectName } = constants_1.initPaths(inputDirectory);
    if (!(await auth_2.isAuthenticated())) {
        await auth_1.default();
    }
    let authKey = (await fs_extra_1.readJson(path_1.join(os_1.homedir(), '.dappstarter', 'user.json'))).id_token;
    await got_1.default(`${constants_1.SERVICE_URL}/system/clean`, {
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
    if (fs_extra_1.pathExists(homeConfigDir)) {
        await fs_extra_1.remove(homeConfigDir);
    }
    console.log(chalk_1.default.blueBright('[CONFIG] Configuration cleaned'));
}
exports.cleanAction = cleanAction;
async function keygen() {
    // Get GeneratedKeys
    const { publicSSH_key } = ssh_1.generateKeys();
    console.log(publicSSH_key);
}
exports.keygen = keygen;
async function localDevleopment() { }
exports.localDevleopment = localDevleopment;
//# sourceMappingURL=develop.subcommands.js.map