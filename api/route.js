import { sendIP, sendSelector } from "./ip.js";
import { sendWhois } from "./whois.js";
import { validate } from "maxmind";
const isSendScript = (headers) =>
  typeof headers["sec-fetch-dest"] !== "undefined" &&
  req.headers["sec-fetch-dest"] === "script";
async function route(req, rep) {
  const path = new URL(req.path, `https://about.address`);
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
