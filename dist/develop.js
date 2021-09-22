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
const events_1 = require("events");
const fs_extra_1 = require("fs-extra");
const chalk_1 = __importDefault(require("chalk"));
const Discovery = require('node-discover');
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const auth_1 = __importStar(require("./auth"));
const got_1 = __importDefault(require("got"));
const ssh_1 = require("./ssh");
const ora_1 = __importDefault(require("ora"));
const emoji = __importStar(require("node-emoji"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const humanize_duration_2 = __importDefault(require("humanize-duration"));
const utils_1 = require("./utils");
const unison_1 = require("./unison");
const config_1 = require("./config");
const uuid_1 = require("uuid");
const RemoteHostForwardingEV = new events_1.EventEmitter();
async function developAction(command) {
    const inputDirectory = (0, utils_1.optionSearch)(command, 'inputDirectory');
    const { configFilePath, folderPath, homeConfigDir, projectName } = (0, config_1.initPaths)(inputDirectory);
    startDiscovery();
    if (!(await (0, auth_1.isAuthenticated)())) {
        await (0, auth_1.default)();
    }
    const authKey = await (0, auth_1.getAuthToken)();
    await (0, config_1.checkLocalFileConfiguration)(folderPath);
    if (!(await (0, fs_extra_1.pathExists)(configFilePath))) {
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
    await (0, fs_extra_1.ensureDir)(homeConfigDir);
    try {
        const { privateKey, publicKey } = await (0, ssh_1.createKeys)(homeConfigDir);
        // Generate unique session id using nanoid
        const sessionId = (0, uuid_1.v4)();
        const manifest = await checkForManifest(folderPath);
        const { projectUrl } = await createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId);
        const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;
        await (0, config_1.storeConfigurationFile)(configFilePath, {
            projectUrl,
        });
        if (!(await (0, ssh_1.isSshOpen)(projectUrl))) {
            return;
        }
        const syncProcess = await (0, unison_1.syncFilesToRemote)(homeConfigDir, folderPath, remoteFolderPath, (0, path_1.join)(homeConfigDir, 'privatekey'));
        const validPorts = await (0, ssh_1.forwardPorts)(config_1.PORTS, projectUrl, privateKey);
        if (!validPorts) {
            return;
        }
        await pingProject(projectName, authKey, sessionId);
        console.log(chalk_1.default.green('[DAPPSTARTER] Connected to dappstarter service'));
        (0, utils_1.log)(chalk_1.default.green(`Startup time: ${(0, humanize_duration_2.default)(new Date().getTime() - startTime)}`));
        await (0, ssh_1.remoteConnect)(projectUrl, privateKey);
    }
    catch (error) {
        console.error('Startup Init Error', error);
    }
}
async function reconnect({ projectName, authKey, homeConfigDir, folderPath, }) {
    const { publicKey, privateKey, projectUrl } = await (0, config_1.getConfiguration)(homeConfigDir);
    const manifest = await checkForManifest(folderPath);
    const sessionId = (0, uuid_1.v4)();
    (0, config_1.setIsRemoteContainer)(true);
    await createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId);
    if (!(await (0, ssh_1.isSshOpen)(projectUrl))) {
        return;
    }
    async function connectedResources(silent = false) {
        if (config_1.PRIMARY_HOST_PROCESS) {
            await (0, unison_1.syncFilesToRemote)(homeConfigDir, folderPath, remoteFolderPath, (0, path_1.join)(homeConfigDir, 'privatekey'));
            const validPorts = await (0, ssh_1.forwardPorts)(config_1.PORTS, projectUrl, privateKey, silent);
            if (!validPorts) {
                return false;
            }
        }
        return true;
    }
    const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;
    RemoteHostForwardingEV.on('check', connectedResources.bind(null, true));
    if (!(await connectedResources())) {
        return;
    }
    console.log(chalk_1.default.green('[DAPPSTARTER] Reconnected to dappstarter service'));
    await pingProject(projectName, authKey, sessionId);
    await (0, ssh_1.remoteConnect)(projectUrl, privateKey);
    // Close process to shutdown all open ports
    process.exit(0);
}
async function createRemoteContainer(projectName, publicKey, authKey, manifest, sessionId) {
    let startTime = new Date().getTime();
    let text = () => `Creating remote container... ${(0, humanize_duration_1.default)(new Date().getTime() - startTime, { maxDecimalPoints: 1 })} `;
    let spinner = (0, ora_1.default)(text()).start();
    let timer = setInterval(() => (spinner.text = text()), 1000);
    const { body } = await (0, got_1.default)(`${config_1.SERVICE_URL}/system/start`, {
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
            publicUrlEnabled: config_1.PUBLIC_URL_ENABLED,
            ports: config_1.CUSTOM_PORTS ? config_1.PORTS : null,
        },
    });
    await monitorContainerStatus(projectName, authKey);
    clearInterval(timer);
    spinner.stopAndPersist({
        symbol: emoji.get('heavy_check_mark'),
        text: spinner.text +
            chalk_1.default.green(`Container created: ${body.projectUrl.replace('.ssh', '')}`),
    });
    return body;
}
async function monitorContainerStatus(projectName, authKey) {
    let timeout = (0, rxjs_1.timer)(5 * 60 * 1000);
    await (0, rxjs_1.interval)(5000)
        .pipe((0, operators_1.startWith)(0), (0, operators_1.map)(() => (0, rxjs_1.defer)(async () => await checkContainerStatus(projectName, authKey))), (0, operators_1.mergeAll)(1), (0, operators_1.takeWhile)((x) => {
        return !x;
    }), (0, operators_1.takeUntil)(timeout))
        .toPromise();
}
async function checkContainerStatus(projectName, authKey) {
    const { body } = await (0, got_1.default)(`${config_1.SERVICE_URL}/system/status`, {
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
    (0, rxjs_1.connectable)((0, rxjs_1.interval)(10 * 1000).pipe((0, operators_1.map)(() => (0, rxjs_1.defer)(async () => {
        const { body } = await (0, got_1.default)(`${config_1.SERVICE_URL}/system/ping`, {
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
    }).pipe((0, operators_1.catchError)((err) => rxjs_1.EMPTY))), (0, operators_1.mergeAll)(1))).connect();
}
async function checkForManifest(folderPath) {
    const path = (0, path_1.join)(folderPath, 'settings.json');
    if (await (0, fs_extra_1.pathExists)(path)) {
        return await (0, fs_extra_1.readJSON)(path);
    }
    return null;
}
function startDiscovery() {
    const discovery = new Discovery({ mastersRequired: 1 });
    discovery.on('promotion', () => {
        (0, config_1.setPrimaryHostProcess)(true);
        RemoteHostForwardingEV.emit('check');
    });
}
//# sourceMappingURL=develop.js.map