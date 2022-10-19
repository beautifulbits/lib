import Table from 'cli-table';
import consola from 'consola';

export function showVersionsAsTable(packageName: string, versions: string[]) {
  const table = new Table({
    head: [`Package`, `Version`],
  });

  versions.forEach((version: string, index: number) => {
    if (index === 0) {
      table.push([packageName, version]);
    } else {
      table.push(['', version]);
    }
  });

  consola.log(table.toString());
}
