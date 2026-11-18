import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export default async function markMsiInstall(project) {
  const xml = await readFile(project, "utf8");
  const componentGroupEnd = "</ComponentGroup>";
  if (xml.split(componentGroupEnd).length !== 2) throw new Error("Cannot locate the MSI application component group.");

  await writeFile(join(dirname(project), "msi-install.marker"), "msi\n");
  await writeFile(project, xml.replace(componentGroupEnd, [
    '<Component Id="MsiInstallMarker">',
    '  <File Name="msi-install.marker" Source="msi-install.marker" KeyPath="yes"/>',
    '</Component>',
    componentGroupEnd,
  ].join("\n")));
}
