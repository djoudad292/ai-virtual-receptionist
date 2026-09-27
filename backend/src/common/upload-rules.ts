import { BadRequestException } from '@nestjs/common';
import pdfParse from 'pdf-parse';

export const TEXT_EXTS = ['txt', 'md', 'markdown'];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTS = [...TEXT_EXTS, 'pdf'];

export interface UploadedFileValidation {
  ext: string;
  isPdf: boolean;
  title: string;
}

export function validateUploadedFile(file?: Express.Multer.File): UploadedFileValidation {
  if (!file || !file.buffer) {
    throw new BadRequestException('No file uploaded');
  }
  const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new BadRequestException('Only .txt, .md and .pdf files are supported');
  }
  const isPdf = ext === 'pdf';
  if (file.size > (isPdf ? MAX_PDF_BYTES : MAX_FILE_BYTES)) {
    throw new BadRequestException(isPdf ? 'PDF must be under 10MB' : 'File must be under 2MB');
  }
  const title = file.originalname.replace(/\.(txt|md|markdown|pdf)$/i, '');
  return { ext, isPdf, title };
}

export interface ExtractedText {
  content: string;
  pageCount: number;
}

export async function extractFileText(file: Express.Multer.File, isPdf: boolean): Promise<ExtractedText> {
  let content = '';
  let pageCount = 0;

  if (isPdf) {
    try {
      const parsed = await pdfParse(file.buffer);
      content = (parsed.text || '').trim();
      pageCount = parsed.numpages || 0;
    } catch {
      // PDF parse failure is treated as no readable text below.
    }
    if (!content) {
      throw new BadRequestException(
        'No readable text was extracted from the PDF. It may be scanned or image-only.',
      );
    }
  } else {
    content = file.buffer.toString('utf8').trim();
    if (!content) {
      throw new BadRequestException('File is empty');
    }
  }

  return { content, pageCount };
}
