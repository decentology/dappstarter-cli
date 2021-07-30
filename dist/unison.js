"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFilesToRemote = exports.downloadUnison = void 0;
const got_1 = __importDefault(require("got"));
const tar_stream_1 = require("tar-stream");
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const zlib_1 = require("zlib");
const shelljs_1 = require("shelljs");
const unzipper_1 = require("unzipper");
const slashes_1 = require("slashes");
async function downloadUnison() {
    const dir = path_1.join(os_1.homedir(), '.dappstarter', 'unison');
    await fs_extra_1.ensureDir(dir);
    if (await fs_extra_1.pathExists(path_1.join(dir, 'bin'))) {
        return;
    }
    return await new Promise(async (resolve) => {
        let downloadUrl = null;
        switch (os_1.platform()) {
            case 'darwin':
                downloadUrl =
                    'https://github.com/bcpierce00/unison/releases/download/v2.51.4/unison-v2.51.4+ocaml-4.12.0+x86_64.macos-10.15.tar.gz';
                break;
            case 'linux':
                downloadUrl =
                    'https://github.com/bcpierce00/unison/releases/download/v2.51.4/unison-v2.51.4+ocaml-4.08.1+x86_64.linux.tar.gz';
                break;
            case 'win32':
                downloadUrl =
                    'https://github.com/bcpierce00/unison/releases/download/v2.51.4/unison-v2.51.4+ocaml-4.08.1+x86_64.windows.zip';
                break;
        }
        if (downloadUrl == null) {
            throw new Error('Unsupported platform');
        }
        const response = await got_1.default(downloadUrl, { isStream: true });
        if (os_1.platform() === 'darwin' || os_1.platform() === 'linux') {
            const untar = tar_stream_1.extract();
            untar
                .on('entry', async (header, stream, next) => {
                const { name, type, mode } = header;
                if (type === 'directory') {
                    next();
                }
                else {
                    await fs_extra_1.ensureDir(path_1.join(dir, path_1.dirname(name)));
                    stream.pipe(fs_1.createWriteStream(path_1.join(dir, name), { mode }));
                    stream.on('end', () => next());
                }
            })
                .on('end', () => {
                resolve(true);
            });
            response.pipe(zlib_1.createGunzip()).pipe(untar);
        }
        else if (os_1.platform() === 'win32') {
            await response.pipe(unzipper_1.Extract({ path: dir })).promise();
            resolve(true);
        }
    });
}
exports.downloadUnison = downloadUnison;
async function syncFilesToRemote(localPath, remotePath, privateKeyPath) {
    await downloadUnison();
    const unison = path_1.join(os_1.homedir(), '.dappstarter', 'unison', 'bin', os_1.platform() === 'win32' ? 'unison.exe' : 'unison');
    if (os_1.platform() === 'win32') {
        privateKeyPath = slashes_1.addSlashes(privateKeyPath);
    }
    const proc = shelljs_1.exec(`${unison} -repeat 1 -batch -copyonconflict -dontchmod -perms 0 -sshargs "-o StrictHostKeyChecking=no -i ${privateKeyPath}" -ignore "Name node_modules" -ignore "Name .git" ${localPath} ${remotePath}`, { silent: true }, (code, stdout, stderr) => {
        if (code != null) {
            console.log(`Unison exit code: ${code}`);
        }
        console.error('error', stderr);
    });
    return proc;
}
exports.syncFilesToRemote = syncFilesToRemote;
//# sourceMappingURL=unison.js.map