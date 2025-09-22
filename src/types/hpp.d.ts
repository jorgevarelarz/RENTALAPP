declare module 'hpp' {
  import { RequestHandler } from 'express';
  interface Options {
    whitelist?: string[];
    checkBody?: boolean;
    checkQuery?: boolean;
    checkParams?: boolean;
  }
  function hpp(options?: Options): RequestHandler;
  export default hpp;
}
