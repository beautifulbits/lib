import Table from 'cli-table';
import consola from 'consola';
export function showVersionsAsTable(packageName, versions) {
    const table = new Table({
        head: [`Package`, `Version`],
    });
    versions.forEach((version, index) => {
        if (index === 0) {
            table.push([packageName, version]);
        }
        else {
            table.push(['', version]);
        }
    });
    consola.log(table.toString());
}
//# sourceMappingURL=show-versions-as-table.js.map