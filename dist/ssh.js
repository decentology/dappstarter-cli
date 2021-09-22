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
exports.createKeys = exports.generateKeys = exports.forwardRemotePort = exports.forwardPorts = exports.isSshOpen = exports.remoteConnect = void 0;
const promises_1 = require("dns/promises");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const keypair_1 = __importDefault(require("keypair"));
const node_forge_1 = __importDefault(require("node-forge"));
const node_ssh_forward_1 = require("node-ssh-forward");
const ssh2_1 = require("ssh2");
const ora_1 = __importDefault(require("ora"));
const emoji = __importStar(require("node-emoji"));
const rxjs_1 = require("rxjs");
const attempt_1 = require("@lifeomic/attempt");
const promise_timeout_1 = require("promise-timeout");
const is_reachable_1 = __importDefault(require("is-reachable"));
const chalk_1 = __importDefault(require("chalk"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const get_port_1 = __importDefault(require("get-port"));
const utils_1 = require("./utils");
async function remoteConnect(projectUrl, privateKey) {
    return new Promise(async (resolve) => {
        const conn = new ssh2_1.Client();
        conn.on('error', async () => {
            // Handling error event prevents process termination. Need to handle reconnection
            console.log(chalk_1.default.yellow(`[SSH] Connection lost`));
            // await remoteConnect(projectUrl, privateKey);
        });
        conn.on('ready', function () {
            conn.shell({
                term: process.env.TERM,
                rows: process.stdout.rows,
                cols: process.stdout.columns,
            }, function (err, stream) {
                if (err)
                    throw err;
                // stream.stdin.write('cd /app\nclear\n', 'utf-8');
                // Connect local stdin to remote stdin
                process.stdin.setRawMode(true);
                process.stdin.pipe(stream);
                // Connect remote output to local stdout
                stream.pipe(process.stdout);
                stream.on('close', () => {
                    // Don't let process.stdin keep process alive since we no longer need it
                    process.stdin.unref();
                    conn.end();
                    resolve();
                });
                stream.on('exit', () => {
                    conn.end();
                    resolve();
                });
                process.stdout.on('resize', () => {
                    // Let the remote end know when the local terminal has been resized
                    stream.setWindow(process.stdout.rows, process.stdout.columns, 0, 0);
                });
            });
        }).connect({
            host: projectUrl,
            port: 22,
            username: 'dappstarter',
            privateKey: privateKey,
            keepaliveCountMax: 10,
            keepaliveInterval: 5000,
        });
    });
}
exports.remoteConnect = remoteConnect;
async function isSshOpen(projectUrl) {
    const startTime = new Date().getTime();
    const timeout = (0, rxjs_1.timer)(5 * 60 * 1000);
    const updateText = () => `Waiting for container to be connectable... ${(0, humanize_duration_1.default)(startTime - new Date().getTime(), { maxDecimalPoints: 1 })} `;
    const spinner = (0, ora_1.default)(updateText()).start();
    const result = await (0, rxjs_1.lastValueFrom)((0, rxjs_1.interval)(1000).pipe((0, rxjs_1.tap)(() => (spinner.text = updateText())), (0, rxjs_1.mergeMap)(() => (0, rxjs_1.defer)(async () => await (0, is_reachable_1.default)(`${projectUrl}:22`))), (0, rxjs_1.takeWhile)((x) => !x, true), (0, rxjs_1.takeUntil)(timeout)), { defaultValue: true });
    if (result) {
        spinner.stopAndPersist({
            symbol: emoji.get('heavy_check_mark'),
            text: spinner.text + chalk_1.default.green('Connected'),
        });
    }
    else {
        spinner.stopAndPersist({
            symbol: emoji.get('x'),
            text: spinner.text + chalk_1.default.red('Not Connected'),
        });
    }
    return result;
}
exports.isSshOpen = isSshOpen;
async function checkPortIsAvailable(port) {
    let checkPort = await (0, get_port_1.default)({ port });
    if (checkPort !== port) {
        return { port, valid: false };
    }
    return { port, valid: true };
}
async function forwardPorts(ports, host, privateKey, silent = false) {
    if (!silent) {
        process.stdin.pause();
    }
    const portNumbers = ports.map((port) => {
        if (typeof port === 'number') {
            return port;
        }
        return port.localPort;
    });
    const portTextPrefix = 'Forwarding ports: ';
    let portText = portTextPrefix + portNumbers.map((x) => chalk_1.default.gray(x)).join(',');
    const spinner = (0, ora_1.default)(`Forwarding ports: `).start();
    let portStatus = await Promise.all(portNumbers.map(async (port) => {
        return checkPortIsAvailable(port);
    }));
    const arePortsAvailable = portStatus.every((x) => x.valid === true);
    if (arePortsAvailable) {
        await Promise.all(portNumbers.map(async (port) => {
            portText = portText.replace(port.toString(), chalk_1.default.yellow(port.toString()));
            spinner.text = portText;
            const connection = await forwardRemotePort({
                port,
                host,
                privateKey,
            });
            if (connection == null) {
                console.log(chalk_1.default.red(`Failed to forward port ${port}`));
                process.exit(1);
            }
            portText = portText.replace(port.toString(), chalk_1.default.green(port.toString()));
            spinner.text = portText;
        }));
        spinner.stopAndPersist({
            symbol: emoji.get('heavy_check_mark'),
            text: portText,
        });
        process.stdin.resume();
        return true;
    }
    portStatus
        .filter((x) => !x.valid)
        .forEach((port) => {
        portText = portText.replace(port.port.toString(), chalk_1.default.red(port.port.toString()));
    });
    spinner.stopAndPersist({
        symbol: emoji.get('x'),
        text: portText,
    });
    process.stdin.resume();
    return false;
}
exports.forwardPorts = forwardPorts;
async function forwardRemotePort({ port, remotePort, host, privateKey, }) {
    try {
        const connection = await (0, attempt_1.retry)(async (context) => {
            return await (0, promise_timeout_1.timeout)(new Promise(async (resolve, reject) => {
                let dnsResult = null;
                try {
                    dnsResult = await (0, promises_1.lookup)(host);
                    // console.log(dnsResult);
                }
                catch (error) {
                    return reject(`Could not resolve ${host}`);
                }
                try {
                    const connection = new node_ssh_forward_1.SSHConnection({
                        endHost: dnsResult.address,
                        privateKey,
                        username: 'dappstarter',
                        endPort: 22,
                        keepaliveCountMax: 10,
                        keepaliveInterval: 5000,
                    });
                    await connection.forward({
                        fromPort: port,
                        toPort: remotePort || port,
                    });
                    // This isn't being used. Keeping here as reminder how to handle reconnect with updating console.log
                    async function reconnect() {
                        process.stdin.pause();
                        console.log(chalk_1.default.yellow(`Port ${port} disconnected. Reconnecting...`));
                        await forwardRemotePort({
                            port,
                            remotePort,
                            host,
                            privateKey,
                        });
                        process.stdin.resume();
                    }
                    return resolve(connection);
                }
                catch (error) {
                    reject(error);
                }
            }).catch((err) => {
                throw err;
            }), 8000).catch((err) => {
                throw err;
            });
        }, {
            maxAttempts: 120,
            delay: 1000,
            handleError: (error, context) => {
                (0, utils_1.log)(error);
                if (error.message ===
                    'All configured authentication methods failed') {
                    context.abort();
                }
            },
            beforeAttempt: (context, options) => {
                var i = 1;
                // console.log('Attempting to reconnect', context.attemptNum);
            },
        });
        return connection;
    }
    catch (error) {
        console.error(`[SSH] ${error.message}`);
        return null;
    }
}
exports.forwardRemotePort = forwardRemotePort;
function generateKeys() {
    const { private: privatePemKey, public: publicPemKey } = (0, keypair_1.default)();
    let publicKey = node_forge_1.default.pki.publicKeyFromPem(publicPemKey);
    let privateKey = node_forge_1.default.pki.privateKeyFromPem(privatePemKey);
    let publicSSH_key = node_forge_1.default.ssh.publicKeyToOpenSSH(publicKey, 'dappstarter@localhost');
    let privateSSH_key = node_forge_1.default.ssh.privateKeyToOpenSSH(privateKey);
    return {
        publicSSH_key,
        privateSSH_key,
    };
}
exports.generateKeys = generateKeys;
async function createKeys(homeConfigDir) {
    const { publicSSH_key, privateSSH_key } = generateKeys();
    await (0, fs_extra_1.writeFile)((0, path_1.join)(homeConfigDir, 'publickey'), publicSSH_key, {
        mode: 0o600,
    });
    await (0, fs_extra_1.writeFile)((0, path_1.join)(homeConfigDir, 'privatekey'), privateSSH_key, {
        mode: 0o600,
    });
    return {
        privateKey: privateSSH_key,
        publicKey: publicSSH_key,
    };
}
exports.createKeys = createKeys;
//# sourceMappingURL=ssh.js.map