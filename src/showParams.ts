import { from, defer } from "rxjs";
import { map, mergeAll } from "rxjs/operators";
import * as inquirer from "inquirer";

export default async function showParams(options: any, path: string, params: any) {
  return await from(params)
    .pipe(
      map((param: any) =>
        defer(async () => {
          let {
            name,
            title,
            description,
            placeholder,
            options: paramOptions,
          } = param;

          if (param.type === "choice") {
            const menuList = param.options.map((x: any) => x.title);
            let { value } = await inquirer.prompt({
              name: "value",
              type: "list",
              message: `Choose ${title}`,
              choices: menuList,
            });

            let selection = paramOptions.find((x: any) => x.title == value);
            let optionPath = path + "/" + name;
            options[optionPath] = selection.name;
          } else {
            placeholder =
              placeholder != null
                ? ` (${placeholder}, ${description})`
                : ` (${description})`;
            let value: string[] = await inquirer.prompt({
              name,
              type: "input",
              message: `Enter: ${title}${placeholder}`,
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
