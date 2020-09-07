const inquirer = require("inquirer");
const { default: idx } = require("idx");
const { processOptions } = require("./processOptions");

async function processManifest(blockchain, options, manifest) {
  let { singular, name, children } = manifest;
  let menuList = children
    .filter((x) => idx(x, () => x.interface.enabled))
    .filter((x) => {
      if (blockchain.value != "" && x.blockchains) {
        return x.blockchains.indexOf(blockchain.value) > -1;
      }
      return true;
    })
    .map((x) => x.title);
  if (menuList && menuList.length > 0) {
    let doneMessage = "I'm done!";
    if (name == "categories") {
      menuList.unshift(doneMessage);
    }
    let { value } = await inquirer.prompt({
      type: "list",
      name: "value",
      message: `Select ${singular || name}`,
      choices: menuList,
    });

    let selection = children.find((x) => x.title == value);
    if (selection != null) {
      let pathName;
      if (/blockchains|frameworks/.test(name)) {
        if (name === "blockchains") {
          blockchain.value = selection.name;
        }
        pathName = name.substring(0, name.length - 1);
      } else if (name === "languages") {
        pathName = "blockchain/" + blockchain.value;
      } else if (name == "categories") {
        pathName = "category";
      }
      let path = `/${pathName}/${selection.name}`;
      options[path] = true;
      if (idx(selection, () => selection.children.length) > 0) {
        await processOptions(blockchain.value, options, path, selection);
      }
    }

    if (name == "categories" && value != doneMessage) {
      await processManifest(blockchain, options, manifest);
    }
  }
  // if(children(answer))
}
exports.processManifest = processManifest;
