import { sendIP, sendSelector } from "./ip.js";
import { sendWhois } from "./whois.js";
import { validate } from "maxmind";
import fs from "fs";
import mime from "mime-types";
import path from "path";

const kv = new WeakMap();
const isSendScript = (headers) =>
  typeof headers["sec-fetch-dest"] !== "undefined" &&
  req.headers["sec-fetch-dest"] === "script";
const sendAssets = async(pathRoute,req,rep) => {
  const file = pathRoute.pathname.replace("/assets/","").replace("..","");
  if(!fs.existsSync(`pages/assets/${file}`)){
    rep.statusCode = 404;
    rep.send("404 Not Found.");
  }else{
    await new Promise(resolve=>{
      rep.setHeader("Content-Type",mime.contentType(path.extname(file)));
      rep.setHeader("Content-Length",fs.statSync(`pages/assets/${file}`).size);
      rep.setHeader("Cache-Control", "public, max-age=600");
      resolve();
    }).then(e=>{
      const content = fs.readFileSync(`pages/assets/${file}`,{
        encoding: 'utf8',
      });
      rep.send(content);
    })
  }
  rep.end('\n');
  return;
}
async function route(req, rep) {
  const path = new URL(req.path, `https://about.address`);
  if (path.pathname.startsWith("/assets/")) {
    await sendAssets(path,req,rep);
    return;
  }
  if (path.pathname === "/") {
    await sendIP(path, rep.realip, req, rep);
    return;
  }
  if (path.pathname.startsWith("/whois/")) {
    await sendWhois(path, req, rep);
    return;
  }
  if (
    path.pathname.startsWith("/") &&
    validate(path.pathname.replace("/", ""))
  ) {
    await sendIP(path, path.pathname.replace("/", ""), req, rep);
    return;
  }
  if (
    path.pathname.startsWith("/") &&
    path.pathname.split("/").length - 1 === 1
  ) {
    await sendSelector(
      path.pathname.replace("/", ""),
      rep.realip,
      path.searchParams.get("lang") || "en",
      rep
    );
    return;
  }
  if (
    path.pathname.startsWith("/") &&
    path.pathname.split("/").length - 1 === 2 &&
    validate(path.pathname.split("/")[1])
  ) {
    await sendSelector(
      path.pathname.split("/")[2],
      path.pathname.split("/")[1],
      path.searchParams.get("lang") || "en",
      rep
    );
    return;
  }
}
export default (app) => {
  app.use(route);
};
