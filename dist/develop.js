"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const chalk_1 = __importDefault(require("chalk"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const auth_1 = __importStar(require("./auth"));
const got_1 = __importDefault(require("got"));
const ssh_1 = require("./ssh");
const constants_1 = require("./constants");
const ora_1 = __importDefault(require("ora"));
const emoji = __importStar(require("node-emoji"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const humanize_duration_2 = __importDefault(require("humanize-duration"));
const utils_1 = require("./utils");
const unison_1 = require("./unison");
const config_1 = require("./config");
const uuid_1 = require("uuid");
async function developAction(command) {
    const inputDirectory = utils_1.optionSearch(command, 'inputDirectory');
    const { configFilePath, folderPath, homeConfigDir, projectName } = constants_1.initPaths(inputDirectory);
    if (!(await auth_1.isAuthenticated())) {
        await auth_1.default();
    }
    const authKey = await auth_1.getAuthToken();
    await config_1.checkLocalFileConfiguration(folderPath);
    if (!(await fs_extra_1.pathExists(configFilePath))) {
        try {
            await initialize({
                homeConfigDir,
                folderPath,
                projectName,
                authKey,
                configFilePath,
            });
        }
        catch (error) {
            console.error('Startup Init Error', error);
        }
    }
    else {
        await reconnect({
            authKey,
            projectName,
            configFilePath,
            folderPath,
            homeConfigDir,
        });
    }
    // Close process to shutdown all open ports
    process.exit(0);
}
exports.default = developAction;
async function initialize({ homeConfigDir, folderPath, projectName, authKey, configFilePath, }) {
    let startTime = new Date().getTime();
    await fs_extra_1.ensureDir(homeConfigDir);
    try {
        const { privateKey, publicKey } = await ssh_1.createKeys(homeConfigDir);
        // Generate unique session id using nanoid
        const sessionId = uuid_1.v4();
        const manifest = await checkForManifest(folderPath);
        const { projectUrl } = await createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId);
        const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;
        await config_1.storeConfigurationFile(configFilePath, {
            projectUrl,
        });
        if (!(await ssh_1.isSshOpen(projectUrl))) {
            return;
        }
        const syncProcess = await unison_1.syncFilesToRemote(homeConfigDir, folderPath, remoteFolderPath, path_1.join(homeConfigDir, 'privatekey'));
        const validPorts = await ssh_1.forwardPorts(constants_1.PORTS, projectUrl, privateKey);
        if (!validPorts) {
            return;
        }
        await pingProject(projectName, authKey, sessionId);
        console.log(chalk_1.default.green('[DAPPSTARTER] Connected to dappstarter service'));
        utils_1.log(chalk_1.default.green(`Startup time: ${humanize_duration_2.default(new Date().getTime() - startTime)}`));
        await ssh_1.remoteConnect(projectUrl, privateKey);
    }
    catch (error) {
        console.error('Startup Init Error', error);
    }
}
async function reconnect({ configFilePath, projectName, authKey, homeConfigDir, folderPath, }) {
    const { publicKey, privateKey, projectUrl } = await config_1.getConfiguration(homeConfigDir);
    const manifest = await checkForManifest(folderPath);
    const sessionId = uuid_1.v4();
    await createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId);
    if (!(await ssh_1.isSshOpen(projectUrl))) {
        return;
    }
    const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;
    await unison_1.syncFilesToRemote(homeConfigDir, folderPath, remoteFolderPath, path_1.join(homeConfigDir, 'privatekey'));
    const validPorts = await ssh_1.forwardPorts(constants_1.PORTS, projectUrl, privateKey);
    if (!validPorts) {
        return;
    }
    console.log(chalk_1.default.green('[DAPPSTARTER] Reconnected to dappstarter service'));
    await pingProject(projectName, authKey, sessionId);
    await ssh_1.remoteConnect(projectUrl, privateKey);
    // Close process to shutdown all open ports
    process.exit(0);
}
async function createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId) {
    let startTime = new Date().getTime();
    let text = () => `Creating remote container... ${humanize_duration_1.default(new Date().getTime() - startTime, { maxDecimalPoints: 1 })} `;
    let spinner = ora_1.default(text()).start();
    let timer = setInterval(() => (spinner.text = text()), 1000);
    const { body } = await got_1.default(`${constants_1.SERVICE_URL}/system/start`, {
        method: 'POST',
        retry: {
            limit: 2,
            methods: ['GET', 'POST'],
        },
        headers: {
            Authorization: `bearer ${authKey}`,
        },
        responseType: 'json',
        json: {
            projectName,
            publicKey,
            manifest,
            sessionId,
        },
    });
    await monitorContainerStatus(projectName, authKey);
    clearInterval(timer);
    spinner.stopAndPersist({
        symbol: emoji.get('heavy_check_mark'),
        text: spinner.text + chalk_1.default.green(`Container created: ${body.projectUrl}`),
    });
    return body;
}
async function monitorContainerStatus(projectName, authKey) {
    let timeout = rxjs_1.timer(5 * 60 * 1000);
    await rxjs_1.interval(5000)
        .pipe(operators_1.startWith(0), operators_1.map(() => rxjs_1.defer(async () => await checkContainerStatus(projectName, authKey))), operators_1.mergeAll(1), operators_1.takeWhile((x) => {
        return !x;
    }), operators_1.takeUntil(timeout))
        .toPromise();
}
async function checkContainerStatus(projectName, authKey) {
    const { body } = await got_1.default(`${constants_1.SERVICE_URL}/system/status`, {
        method: 'GET',
        searchParams: { projectName },
        retry: {
            limit: 2,
            methods: ['GET', 'POST'],
        },
        headers: {
            Authorization: `bearer ${authKey}`,
        },
        responseType: 'json',
    });
    if (body.status === 'Running') {
        return true;
    }
    return false;
}
async function pingProject(projectName, authKey, sessionId) {
    rxjs_1.connectable(rxjs_1.interval(10 * 1000).pipe(operators_1.map(() => rxjs_1.defer(async () => {
        const { body } = await got_1.default(`${constants_1.SERVICE_URL}/system/ping`, {
            method: 'POST',
            headers: {
                Authorization: `bearer ${authKey}`,
            },
            responseType: 'json',
            json: {
                projectName,
                sessionId,
            },
        });
        if (body.status === false) {
            console.log(chalk_1.default.yellow('[DAPPSTARTER] Process terminated remotely.'));
            process.exit(1);
        }
    }).pipe(operators_1.catchError((err) => rxjs_1.EMPTY))), operators_1.mergeAll(1))).connect();
}
async function checkForManifest(folderPath) {
    const path = path_1.join(folderPath, 'settings.json');
    if (await fs_extra_1.pathExists(path)) {
        return await fs_extra_1.readJSON(path);
    }
    return null;
}
//# sourceMappingURL=develop.js.map