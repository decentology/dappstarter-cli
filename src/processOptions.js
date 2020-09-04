const inquirer = require("inquirer");
const { default: idx } = require("idx");
const { default: fetch } = require("node-fetch");
const { showParams } = require("./showParams");

async function processOptions(blockchain, options, path, { name, children, interface }) {
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
      await showParams(options, optionPath, selection.parameters);
    }
  } else {
    value.forEach((val) => {
      let selection = children.find((x) => x.title == val);
      let optionPath = path + "/" + selection.name;
      options[optionPath] = true;
    });
  }
}
exports.processOptions = processOptions;
