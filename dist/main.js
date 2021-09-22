#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const version = require('../package.json').version;
const commander_1 = require("commander");
const auth_1 = __importDefault(require("./auth"));
const develop_1 = __importDefault(require("./develop"));
const env_1 = require("./env");
const utils_1 = require("./utils");
const create_1 = __importDefault(require("./create"));
const develop_subcommands_1 = require("./develop.subcommands");
let stdin = {
    stdin: '',
};
process.on('uncaughtException', (err) => {
    if (err.code === 'EADDRINUSE') {
        // console.log('Port already in use');
        return;
    }
    else if (err.message.includes('Timed out while waiting for handshake')) {
        // console.log('Ignoring timeout error');
        return;
    }
    else if (err.message.includes('Could not resolve')) {
        // console.log('Ignoring DNS Resolution error');
        return;
    }
    else {
        console.log('Unhandled exception. Shutting down', err);
    }
    process.exit(1);
});
const program = new commander_1.Command();
program
    // .enablePositionalOptions(true)
    .storeOptionsAsProperties(true)
    .option('-e, --env <environment>', 'Override environment setting.')
    .option('--debug', 'Emits debug progress for each command')
    .description('Full-Stack Blockchain App Mojo!')
    .version(version);
program.on('option:env', (env) => {
    (0, env_1.setEnv)(env);
});
process.on('option:debug', (debug) => {
    (0, utils_1.setLogLevel)(true);
});
program
    .command('login')
    .description('Authenticate with the Decentology service. Used for service connections and containers')
    .action(auth_1.default);
const inputDirectory = (0, commander_1.createOption)('-i, --input-directory <path>', 'Select a different directory then current path');
const cleanCommand = (0, commander_1.createCommand)('clean')
    .description('Completely clears local configuration and removes remote container data and history')
    .storeOptionsAsProperties(true)
    .action(develop_subcommands_1.cleanAction);
const develop = program
    .command('develop')
    .description('Develop using a local or remote container to simplify up development workflow')
    .addOption(inputDirectory)
    .action(develop_1.default);
develop
    .command('down')
    .description('Manually shutdown remote container')
    .action(develop_subcommands_1.downAction);
develop.addCommand(cleanCommand);
const developLocal = develop
    .command('local')
    .addCommand(cleanCommand)
    .description('Use to initialize a docker container for local development')
    .action(develop_subcommands_1.localAction);
developLocal
    .command('down')
    .description('Manually shutdown local container')
    .action(develop_subcommands_1.localDownAction);
program
    .command('create')
    .description('Generate a new DappStarterp project')
    .option('-c, --config <file|url>', 'Loads configuration from file and processes.')
    .option('-o, --output <path>', 'Output directory. If omitted current directory will be used.')
    .option('-w, --write-config [path]', 'Writes configuration to file without processing.')
    .option('-p, --print-config', 'Echos configuration to terminal without processing.')
    .action(create_1.default.bind(this, stdin));
if (process.stdin.isTTY) {
    program.parse(process.argv);
}
else {
    process.stdin.on('readable', function () {
        let chunk = this.read();
        if (chunk !== null) {
            stdin.stdin += chunk;
        }
    });
    process.stdin.on('end', () => program.parse(process.argv));
}
//# sourceMappingURL=main.js.map