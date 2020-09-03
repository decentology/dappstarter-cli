const { Command, option } = require("commander");
const { getManifest, postSelections } = require("./service");
const { promises } = require("fs");
const { readFile, writeFile } = promises;
const { basename, join } = require("path");
const { Observable, from, merge, defer } = require("rxjs");
const {
  flatMap,
  tap,
  map,
  mergeMap,
  concatMap,
  mergeAll,
  switchMap,
} = require("rxjs/operators");
const chalk = require("chalk");
const inquirer = require("inquirer");

const program = new Command();
program.version("1.0.0");
program.description("Full-Stack Blockchain App Mojo!");
let options = [];
const create = program.command("create");
create
  .option("-c, --config <file>", "Loads configuration from file and processes.")
  .option(
    "-o, --output <path>",
    "Output directory. If omitted current directory will be used."
  )
  .option(
    "-w, --write-config [path]",
    "Writes configuration to file without processing."
  )
  .action(async ({ output, writeConfig, config }) => {
    if (config) {
      let configFile = JSON.parse((await readFile(config)).toString());
      await postSelections(output, configFile.name, configFile.blocks);
      return;
    }

    const manifest = await getManifest();
    let dappName = basename(process.cwd());
    if (manifest) {
      let question = `Enter name for your dapp (${dappName}) `;

      let { inputName } = await inquirer.prompt({
        name: "inputName",
        type: "input",
        message: question,
      });

      if (inputName) {
        dappName = inputName;
      }
    }

    await from(manifest)
      .pipe(
        map((manifest) => defer(() => processManifest(manifest))),
        mergeAll(1)
      )
      .toPromise();

    let userConfiguration = {
      name: dappName,
      blocks: {
        ...options,
      },
    };
    if (writeConfig != null) {
      await saveConfig(writeConfig, userConfiguration);
    }

    console.log("Config Selections", options);
  });
program.parse(process.argv);

async function saveConfig(path, config) {
  if (path === "" || path === true) {
    path = join(process.cwd(), "manifest.json");
  }
  await writeFile(path, JSON.stringify(config));
}

async function processManifest(manifest) {
  let { singular, name, children } = manifest;
  let menuList = children
    .filter((x) => x?.interface?.enabled ?? false)
    .map((x) => x.title);
  if (menuList && menuList.length > 0) {
    let doneMessage = "I'm done!";
    if (name == "categories") {
      menuList.unshift(doneMessage);
    }
    let { value } = await inquirer.prompt({
      type: "list",
      name: "value",
      message: `Select ${singular ?? name}`,
      choices: menuList,
    });

    let selection = children.find((x) => x.title == value);
    if (selection != null) {
      let path = `/${name}/${selection.name}`;
      options[path] = true;
      if (selection?.children?.length > 0) {
        await processOptions(path, selection);
      }
    }

    if (name == "categories" && value != doneMessage) {
      await processManifest(manifest);
    }
  }
  // if(children(answer))
}

async function processOptions(path, { name, children, interface }) {
  let menuList = children
    .filter((x) => x?.interface?.enabled)
    .map((x, i) => {
      return { name: x.title };
    });

  let listType = "list";
  switch (interface.children) {
    case "multiple":
      listType = "checkbox";
      break;
  }

  let { value } = await inquirer.prompt({
    name: "value",
    type: listType,
    message: "Select option",
    choices: menuList,
  });

  if (listType !== "checkbox") {
    let selection = children.find((x) => x.title == value);
    let optionPath = path + "/" + selection.name;
    options[optionPath] = true;
    if (selection.parameters != null) {
      await showParams(optionPath, selection.parameters);
    }
  } else {
    value.forEach((val) => {
      let selection = children.find((x) => x.title == val);
      let optionPath = path + "/" + selection.name;
      options[optionPath] = true;
    });
  }
}

async function showParams(path, params) {
  return await from(params)
    .pipe(
      map((param) =>
        defer(async () => {
          if (param.type === "choice") {
          } else {
            let { name, title, description, placeHolder } = param;
            placeHolder = placeHolder != null ? placeHolder + ", " : "";
            let value = await inquirer.prompt({
              name,
              type: "input",
              message: `Enter: ${title} (${placeHolder}{${description}})`,
            });
            let key = path + "/" + name;
            options[key] = value[name];
          }
        })
      ),
      mergeAll(1)
    )
    .toPromise();
}
