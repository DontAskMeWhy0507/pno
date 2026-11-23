import type { NonNullableUserContext } from "../../lib/types";
import { downloadDriveFile, getGoogleAccessToken } from "./google-drive";
import type { TImportFromDriveSchema } from "./import-from-drive.schema";
import { importAnkiBuffer } from "./import-package.handler";

type ImportFromDriveOptions = {
  ctx: NonNullableUserContext;
  input: TImportFromDriveSchema;
};

export const importFromDriveHandler = async ({
  ctx,
  input,
}: ImportFromDriveOptions) => {
  const token = await getGoogleAccessToken(ctx);
  const buffer = await downloadDriveFile(token, input.fileId);
  return importAnkiBuffer(ctx, buffer, input.fileName);
};

export default importFromDriveHandler;
