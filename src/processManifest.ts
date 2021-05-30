import * as inquirer from "inquirer";
import idx from "idx";
import processOptions from "./processOptions";

export default async function processManifest(selections: any, options: any, manifest: any) {
  let { singular, name, children } = manifest;
  let menuList = children
    .filter((x: any) => idx(x, () => x.interface.enabled))
    .filter((x: any) => {
      if (name == "categories") {
        let hasValidChildren = x.children.filter(
          (y: any) =>
            y.blockchains.includes(selections.blockchain) &&
            y.languages.includes(selections.language)
        );

        return hasValidChildren.length > 0;
      } else if (selections.blockchain != "" && x.blockchains) {
        return x.blockchains.includes(selections.blockchain);
      }

      return true;
    })
    .map((x: any) => x.title);
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

    let selection = children.find((x: any) => x.title == value);
    if (selection != null) {
      let pathName;
      if (/blockchains|frameworks/.test(name)) {
        if (name === "blockchains") {
          selections.blockchain = selection.name;
        }
        pathName = name.substring(0, name.length - 1);
      } else if (name === "languages") {
        pathName = "blockchain/" + selections.blockchain;
        selections.language = selection.name;
      } else if (name == "categories") {
        pathName = "category";
      }
      let path = `/${pathName}/${selection.name}`;
      options[path] = true;
      if (idx(selection, () => selection.children.length) > 0) {
        await processOptions(selections.blockchain, options, path, selection);
      }
    }

    if (name == "categories" && value != doneMessage) {
      await processManifest(selections, options, manifest);
    }
  }
  // if(children(answer))
}
