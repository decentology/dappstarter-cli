import { down, upAll } from 'docker-compose';
import { ensureDir, pathExists, writeJSON } from 'fs-extra';
import { join } from 'path';

export async function createDockerCompose(configDir: string, projectName: string, projectFolder: string) {
	let docker = _dockerComposeFile;
	docker.services.dappstarter.container_name = projectName;
	docker.services.dappstarter.hostname = projectName;
	// docker.services.dappstarter.volumes = [`${projectFolder}:/app`]
	await ensureDir(configDir);
	await writeJSON(join(configDir, 'docker-compose.yml'), docker, {spaces: 2});
}

export async function startContainer(configDir: string, projectName: string, projectFolder: string) {
	if (!await pathExists(join(configDir, 'docker-compose.yml'))) {
		await createDockerCompose(configDir, projectName, projectFolder);
	}

	await upAll({
		cwd: configDir,
	});
}

export async function stopContainer(directory: string, publicKey: string) {
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
			"image": "decentology/box",
			"labels": [
				"com.decentology.dappstarter"
			],
			"container_name": "",
			"hostname": "",
			"environment": [
				"PUID=1000",
				"PGID=1000"
			],
			"ports": [
				"5000:5000",
				"5001:5001",
				"5002:5002"
			],
			"networks": [
				"dappstarter"
			],
			volumes: [

			] as string[]
		}

	}
}
