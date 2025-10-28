import { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRouteHandler<TReq extends Request = Request, TRes extends Response = Response> = (
  req: TReq,
  res: TRes,
  next: NextFunction,
) => Promise<unknown>;

const asyncHandler = <TReq extends Request = Request, TRes extends Response = Response>(
  fn: AsyncRouteHandler<TReq, TRes>,
): RequestHandler => {
  return (req, res, next) => {
    void Promise.resolve(fn(req as TReq, res as TRes, next)).catch(next);
  };
};

export default asyncHandler;
