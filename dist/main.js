#!/usr/bin/env node
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
require('dotenv').config();
const commander_1 = require("commander");
const service_1 = require("./service");
const fs_1 = require("fs");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const chalk_1 = __importDefault(require("chalk"));
const inquirer = __importStar(require("inquirer"));
const emoji = __importStar(require("node-emoji"));
const is_url_1 = __importDefault(require("is-url"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const ora_1 = __importDefault(require("ora"));
const processManifest_1 = __importDefault(require("./processManifest"));
const os_1 = require("os");
const auth_1 = __importDefault(require("./auth"));
const develop_1 = __importDefault(require("./develop"));
const { readFile, writeFile, mkdir, stat } = fs_1.promises;
let globalSelections = { blockchain: '', language: '' };
let options = [];
let stdin = '';
const processManifest = processManifest_1.default.bind(null, globalSelections);
const program = new commander_1.Command();
program.version('1.0.0');
program.description('Full-Stack Blockchain App Mojo!');
const login = program.command('login');
login.action(auth_1.default);
const develop = program.command('develop [down|cmd]');
develop.action(develop_1.default);
const create = program.command('create');
create
    .option('-c, --config <file|url>', 'Loads configuration from file and processes.')
    .option('-o, --output <path>', 'Output directory. If omitted current directory will be used.')
    .option('-w, --write-config [path]', 'Writes configuration to file without processing.')
    .option('-p, --print-config', 'Echos configuration to terminal without processing.')
    .action(async ({ output, writeConfig, printConfig, config }) => {
    let authenticated = await stat(path_1.join(os_1.homedir(), '.dappstarter', 'user.json')).catch((err) => false);
    while (!authenticated) {
        if (!authenticated) {
            console.log(chalk_1.default.yellow('You must be authenticated to generate a project. Executing: dappstarter login'));
            await auth_1.default();
            authenticated = await stat(path_1.join(os_1.homedir(), '.dappstarter', 'user.json')).catch((err) => false);
        }
    }
    if (output == null || output === '') {
        output = process.cwd();
        if (output.includes('dappstarter-cli-node') ||
            output.includes('dappstarter-cli')) {
            output = path_1.join(output, 'output');
        }
    }
    if (config || stdin) {
        let configFile = stdin !== '' ? JSON.parse(stdin) : '';
        if (configFile === '') {
            if (is_url_1.default(config)) {
                let spinner = ora_1.default('Fetching configuration...');
                try {
                    spinner.start();
                    configFile = await (await node_fetch_1.default(config)).json();
                    spinner.stopAndPersist({
                        symbol: emoji.get('heavy_check_mark'),
                        text: spinner.text + chalk_1.default.green(' Done!'),
                    });
                }
                catch (error) {
                    if (process.env.DAPPSTARTER_DEBUG === 'true') {
                        console.error(error);
                    }
                    console.log(chalk_1.default.red(`${emoji.get('x')} Unable to load configuration from remote url.`));
                    spinner.stopAndPersist({
                        symbol: emoji.get('x'),
                        text: spinner.text + ' Failure',
                    });
                    return;
                }
            }
            else {
                configFile = JSON.parse((await readFile(config)).toString());
            }
        }
        await service_1.postSelections(output, configFile.name, configFile.blocks);
        return;
    }
    const manifest = await service_1.getManifest();
    if (manifest != null) {
        let dappName = path_1.basename(process.cwd());
        if (manifest) {
            let question = `Enter name for your dapp (${dappName}) `;
            let { inputName } = await inquirer.prompt({
                name: 'inputName',
                type: 'input',
                message: question,
            });
            if (inputName) {
                dappName = inputName;
            }
        }
        await rxjs_1.from(manifest)
            .pipe(operators_1.map((manifest) => rxjs_1.defer(() => processManifest(options, manifest))), operators_1.mergeAll(1))
            .toPromise();
        let userConfiguration = {
            name: dappName,
            blocks: {
                ...options,
            },
        };
        if (printConfig) {
            console.log(userConfiguration);
        }
        else if (writeConfig != null) {
            if (writeConfig === '' || writeConfig === true) {
                writeConfig = path_1.join(process.cwd(), 'manifest.json');
            }
            if (await saveConfig(writeConfig, userConfiguration)) {
                console.log(chalk_1.default.green(`${emoji.get('heavy_check_mark')} DappStarter configuration saved to: ${writeConfig}`));
            }
        }
        else {
            await mkdir(output, { recursive: true });
            await service_1.postSelections(output, dappName, userConfiguration.blocks);
        }
    }
});
if (process.stdin.isTTY) {
    program.parse(process.argv);
}
else {
    process.stdin.on('readable', function () {
        let chunk = this.read();
        if (chunk !== null) {
            stdin += chunk;
        }
    });
    process.stdin.on('end', () => program.parse(process.argv));
}
async function saveConfig(path, config) {
    try {
        await writeFile(path, JSON.stringify(config));
        return true;
    }
    catch (error) {
        console.error(chalk_1.default.red(`${emoji.get('x')} Unable to save configuration.`));
    }
}
//# sourceMappingURL=main.js.map