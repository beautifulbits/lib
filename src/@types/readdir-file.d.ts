export type TReaddirFile = {
  name: string;
  title: string;
  path: string;
  fullname: string;
  extension: string;
  isDirectory: boolean;
  data: string;
};

export type TReaddirFileExtended = TReaddirFile & { relativePath: string };
