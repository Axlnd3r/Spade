// The intro's card uses the site's own Mr. X art (web/src/scene), imported through the bundler.
declare module "*.png" {
  const src: string;
  export default src;
}
