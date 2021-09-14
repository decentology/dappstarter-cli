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
            // debug: async (msg) => {
            // 	await appendFile('log.txt', msg + '\n');
            // },
        });
    });
}
exports.remoteConnect = remoteConnect;
async function isSshOpen(projectUrl) {
    const startTime = new Date().getTime();
    const timeout = rxjs_1.timer(5 * 60 * 1000);
    const updateText = () => `Waiting for container to be connectable... ${humanize_duration_1.default(startTime - new Date().getTime(), { maxDecimalPoints: 1 })} `;
    const spinner = ora_1.default(updateText()).start();
    const result = await rxjs_1.lastValueFrom(rxjs_1.interval(1000).pipe(rxjs_1.tap(() => (spinner.text = updateText())), rxjs_1.mergeMap(() => rxjs_1.defer(async () => await is_reachable_1.default(`${projectUrl}:22`))), rxjs_1.takeWhile((x) => !x, true), rxjs_1.takeUntil(timeout)), { defaultValue: true });
    if (result) {
        spinner.stopAndPersist({
            symbol: emoji.get('heavy_check_mark'),
            text: spinner.text + chalk_1.default.green('Connected'),
        });
    }
    else {
        spinner.stopAndPersist({
            symbol: emoji.get('cross_mark'),
            text: spinner.text + chalk_1.default.red('Not Connected'),
        });
    }
    return result;
}
exports.isSshOpen = isSshOpen;
async function checkPortIsAvailable(port) {
    let checkPort = await get_port_1.default({ port });
    if (checkPort !== port) {
        return { port, valid: false };
    }
    return { port, valid: true };
}
async function forwardPorts(ports, host, privateKey) {
    let portStatus = await Promise.all(ports.map(async (port) => {
        if (typeof port === 'number') {
            return checkPortIsAvailable(port);
        }
        else {
            return checkPortIsAvailable(port.localPort);
        }
    }));
    const arePortsAvailable = portStatus.every((x) => x.valid === true);
    if (arePortsAvailable) {
        for (const port of ports) {
            let connection;
            if (typeof port === 'number') {
                connection = await forwardRemotePort({
                    port,
                    host,
                    privateKey,
                });
                if (connection == null) {
                    console.log(chalk_1.default.red(`Failed to forward port ${port}`));
                    process.exit(1);
                }
            }
            else {
                connection = await forwardRemotePort({
                    port: port.localPort,
                    host,
                    privateKey,
                    remotePort: port.remotePort || port.localPort,
                });
            }
            if (connection == null) {
                console.log(chalk_1.default.red(`Failed to forward port ${port}`));
                process.exit(1);
            }
        }
        return true;
    }
    else if (portStatus.every((x) => x.valid === false)) {
        // Every port used. Likely connected to another terminal session.
        return true;
    }
    portStatus
        .filter((x) => !x.valid)
        .forEach((port) => {
        console.log(chalk_1.default.red(`Port ${port.port} is already in use.`));
    });
    return false;
}
exports.forwardPorts = forwardPorts;
async function forwardRemotePort({ port, remotePort, host, privateKey, }) {
    let spinner = ora_1.default(`Fowarding port ${port} `).start();
    try {
        const connection = await attempt_1.retry(async (context) => {
            return await promise_timeout_1.timeout(new Promise(async (resolve, reject) => {
                let dnsResult = null;
                try {
                    dnsResult = await promises_1.lookup(host);
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
                    });
                    await connection.forward({
                        fromPort: port,
                        toPort: remotePort || port,
                    });
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
                utils_1.log(error);
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
        spinner.clear();
        spinner.stopAndPersist({
            symbol: emoji.get('heavy_check_mark'),
            text: `Port ${port} forwarded to ${host}`,
        });
        return connection;
    }
    catch (error) {
        spinner.fail('SSH connection error');
        console.error(`[SSH] ${error.message}`);
        return null;
    }
}
exports.forwardRemotePort = forwardRemotePort;
function generateKeys() {
    const { private: privatePemKey, public: publicPemKey } = keypair_1.default();
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
    await fs_extra_1.writeFile(path_1.join(homeConfigDir, 'publickey'), publicSSH_key, {
        mode: 0o600,
    });
    await fs_extra_1.writeFile(path_1.join(homeConfigDir, 'privatekey'), privateSSH_key, {
        mode: 0o600,
    });
    return {
        privateKey: privateSSH_key,
        publicKey: publicSSH_key,
    };
}
exports.createKeys = createKeys;
//# sourceMappingURL=ssh.js.map