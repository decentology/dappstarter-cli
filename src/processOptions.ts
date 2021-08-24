import * as inquirer from 'inquirer';
import idx from 'idx';
import showParams from './showParams';

export default async function processOptions(
	blockchain: any,
	options: any,
	path: string,
	{
		name,
		children,
		interface: ui,
	}: { name: string; children: any[]; interface: any }
) {
	let menuList = children
		.filter((x) => idx(x, () => x.interface.enabled))
		.filter((x) => {
			if (x.blockchains) {
				return x.blockchains.indexOf(blockchain) > -1;
			}
			return true;
		})
		.map((x, i) => {
			return { name: x.title };
		});

	let listType = 'list';
	switch (ui.children) {
		case 'multiple':
		case 'form':
			listType = 'checkbox';
			break;
	}

	let { value } = await inquirer.prompt({
		name: 'value',
		// @ts-ignore
		type: listType,
		message: 'Select option',
		choices: menuList,
	});

	if (listType !== 'checkbox') {
		let selection = children.find((x) => x.title == value);
		let optionPath = path + '/' + selection.name;
		options[optionPath] = true;
		if (selection.parameters != null) {
			await showParams(options, optionPath, selection.parameters);
		}
	} else {
		value.forEach((val: string) => {
			let selection = children.find((x) => x.title == val);
			let optionPath = path + '/' + selection.name;
			options[optionPath] = true;
		});
	}
}
