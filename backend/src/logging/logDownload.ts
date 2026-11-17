import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';

import { fileSize } from './logFile';

/**
 * A log file as it is now, as an attachment, or null when it doesn't exist.
 * It stops at the size the file had now, so lines written meanwhile can't
 * cut it mid-line.
 */
export const logFileDownload = async (file: string, fileName: string) => {
  const size = await fileSize(file);
  if (size === null) return null;
  const options = {
    type: 'text/plain; charset=utf-8',
    disposition: `attachment; filename="${fileName}"`,
    length: size,
  };
  return size === 0
    ? new StreamableFile(Buffer.alloc(0), options)
    : new StreamableFile(
        createReadStream(file, { start: 0, end: size - 1 }),
        options,
      );
};
