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
exports.stopContainer = exports.startContainer = exports.createDockerCompose = void 0;
const docker_compose_1 = require("docker-compose");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const constants_1 = require("./constants");
const pty = __importStar(require("node-pty"));
const command_exists_1 = __importDefault(require("command-exists"));
const chalk_1 = __importDefault(require("chalk"));
async function createDockerCompose(configDir, projectName, projectFolder) {
    let docker = _dockerComposeFile;
    docker.services.dappstarter.container_name = projectName;
    docker.services.dappstarter.hostname = projectName;
    docker.services.dappstarter.volumes = [`${projectFolder}:/app`];
    docker.services.dappstarter.ports = constants_1.PORTS.map(port => `${port}:${port}`);
    await fs_extra_1.ensureDir(configDir);
    await fs_extra_1.writeJSON(path_1.join(configDir, 'docker-compose.yml'), docker, { spaces: 2 });
}
exports.createDockerCompose = createDockerCompose;
async function startContainer(configDir, projectName, projectFolder) {
    return new Promise(async (resolve) => {
        if (!await fs_extra_1.pathExists(path_1.join(configDir, 'docker-compose.yml'))) {
            await createDockerCompose(configDir, projectName, projectFolder);
        }
        const dockerComposeExists = await command_exists_1.default('docker-compose');
        if (dockerComposeExists) {
            await docker_compose_1.upAll({
                cwd: configDir,
            });
            const childProc = pty.spawn('docker-compose', [
                'exec',
                '--workdir',
                '/app',
                'dappstarter',
                'bash'
            ], {
                name: 'xterm-color',
                cwd: configDir,
                cols: process.stdout.columns,
                rows: process.stdout.rows,
            });
            process.stdin.setRawMode(true);
            process.stdout.on('resize', () => {
                childProc.resize(process.stdout.columns, process.stdout.rows);
            });
            childProc.onData(data => process.stdout.write(data));
            process.stdin.on('data', data => childProc.write(data.toString()));
            childProc.onExit(() => {
                process.stdin.unref();
                resolve(true);
            });
        }
        else {
            console.log(chalk_1.default.red(`Docker Compose is not installed`));
            resolve(false);
        }
    });
}
exports.startContainer = startContainer;
async function stopContainer(directory) {
    await docker_compose_1.down({
        cwd: directory,
    });
}
exports.stopContainer = stopContainer;
const _dockerComposeFile = {
    "version": "3.7",
    "networks": {
        "dappstarter": {
            "name": "dappstarter",
            "driver": "bridge"
        }
    },
    "services": {
        "dappstarter": {
            "image": "decentology.azurecr.io/decentology-box",
            "labels": [
                "com.decentology.dappstarter"
            ],
            "container_name": "",
            "hostname": "",
            "tty": true,
            "environment": [
                "PUID=1000",
                "PGID=1000"
            ],
            "ports": [],
            "networks": [
                "dappstarter"
            ],
            volumes: []
        }
    }
};
//# sourceMappingURL=docker.js.map