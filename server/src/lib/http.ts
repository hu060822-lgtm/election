import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type output } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const asyncH =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'invalid_input', message: '輸入資料格式不正確', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === '23505') return res.status(409).json({ error: 'conflict', message: '資料重複，請確認後再試' });
  if (pgCode === '23503') return res.status(409).json({ error: 'reference', message: '關聯資料不存在或仍被使用' });
  if (pgCode === '23502' || pgCode === '23514') return res.status(400).json({ error: 'invalid_input', message: '必填欄位缺漏或格式不符' });
  if (pgCode === '22P02') return res.status(400).json({ error: 'invalid_input', message: '識別碼格式不正確' });
  if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'too_large', message: '檔案超過 3MB 上限' });
  console.error(err);
  res.status(500).json({ error: 'server_error', message: '伺服器暫時無法處理，請稍後再試' });
}
