const local_library = require('../local-library');
// @ponicode
describe('local_library.LocalLibrary.grabPackageFilesForPublish', () => {
  let inst;

  beforeEach(() => {
    inst = new local_library.LocalLibrary();
  });

  test('0', async () => {
    await inst.grabPackageFilesForPublish('Île-de-France');
  });

  test('1', async () => {
    await inst.grabPackageFilesForPublish('Abruzzo');
  });

  test('2', async () => {
    await inst.grabPackageFilesForPublish('Alabama');
  });

  test('3', async () => {
    await inst.grabPackageFilesForPublish('');
  });
});
