import { down, exec, upAll } from 'docker-compose';
import { ensureDir, pathExists, writeJSON } from 'fs-extra';
import { join } from 'path';
import { PORTS } from './constants';
import childProcess from 'child_process'
import * as pty from 'node-pty'


export async function createDockerCompose(configDir: string, projectName: string, projectFolder: string) {
	let docker = _dockerComposeFile;
	docker.services.dappstarter.container_name = projectName;
	docker.services.dappstarter.hostname = projectName;
	docker.services.dappstarter.volumes = [`${projectFolder}:/app`]
	docker.services.dappstarter.ports = PORTS.map(port => `${port}:${port}`);
	await ensureDir(configDir);
	await writeJSON(join(configDir, 'docker-compose.yml'), docker, { spaces: 2 });
}

export async function startContainer(configDir: string, projectName: string, projectFolder: string) {
	return new Promise(async resolve => {
		if (!await pathExists(join(configDir, 'docker-compose.yml'))) {
			await createDockerCompose(configDir, projectName, projectFolder);
		}

		await upAll({
			cwd: configDir,
		});

		// await exec('dappstarter','/bin/bash', {
		// 	cwd: configDir,
		// });

		const childProc = pty.spawn('docker-compose', [
			'exec',
			'dappstarter',
			'bash'
		],
			{
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
			console.log('Closing Connection');
			process.stdin.unref();
			resolve(true);
		});

	});
}

export async function stopContainer(directory: string) {
	await down({
		cwd: directory,
	});
}

const _dockerComposeFile =
{
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
			"ports": [
			] as string[],
			"networks": [
				"dappstarter"
			],
			volumes: [

			] as string[]
		}

	}
}
