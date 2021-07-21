import got from 'got';
import { extract } from 'tar-stream';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import { createWriteStream } from 'fs';
import { ensureDir, pathExists } from 'fs-extra';
import { createGunzip } from 'zlib';
import { exec } from 'shelljs';
import { Extract as zipExtract } from 'unzipper';
import { addSlashes } from 'slashes';

export async function downloadUnison() {
	const dir = join(homedir(), '.dappstarter', 'unison');
	await ensureDir(dir);

	if (await pathExists(join(dir, 'bin', 'unison'))) {
		return;
	}

	return await new Promise(async (resolve) => {
		let downloadUrl = null;
		switch (platform()) {
			case 'darwin':
				downloadUrl =
					'https://github.com/bcpierce00/unison/releases/download/v2.51.4/Unison-v2.51.4.ocaml-4.08.1.macos-10.15.app.tar.gz';
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

		const response = await got(downloadUrl, { isStream: true });

		if (platform() === 'darwin' || platform() === 'linux') {
			const untar = extract();
			untar
				.on('entry', async (header, stream, next) => {
					const { name, type, mode } = header;
					if (type === 'directory') {
						next();
					} else {
						await ensureDir(join(dir, dirname(name)));

						stream.pipe(
							createWriteStream(join(dir, name), { mode })
						);
						stream.on('end', () => next());
					}
				})
				.on('end', () => {
					resolve(true);
				});
			response.pipe(createGunzip()).pipe(untar);
		} else if (platform() === 'win32') {
			response.pipe(zipExtract({ path: dir }));
		}
	});
}

export async function syncFilesToRemote(
	localPath: string,
	remotePath: string,
	privateKeyPath: string
) {
	await downloadUnison();
	const unison = join(
		homedir(),
		'.dappstarter',
		'unison',
		'bin',
		platform() === 'win32' ? 'unison.exe' : 'unison'
	);
	if (platform() === 'win32') {
		privateKeyPath = addSlashes(privateKeyPath);
	}
	const proc = exec(
		`${unison} -repeat 1 -batch -copyonconflict -dontchmod -perms 0 -sshargs "-o StrictHostKeyChecking=no -i ${privateKeyPath}" -ignore "Name node_modules" -ignore "Name .git" ${localPath} ${remotePath}`,
		{ silent: true },
		(code, stdout, stderr) => {
			if (code != null) {
				console.log(`Unison exit code: ${code}`);
			}
			console.error('error', stderr);
		}
	);
	return proc;
}
