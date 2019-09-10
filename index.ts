import * as dotenv from "dotenv";
import * as crypto from "crypto";
import * as express from "express";
import * as bodyParser from "body-parser";
import { exec, ExecException } from "child_process";

dotenv.config();

const secret = process.env.SECRET;
const ghRepo = process.env.REPO;
const ghUsername = process.env.GH_USERNAME;
const ghToken = process.env.GH_TOKEN;
const ghRepoUrl = `https://github.com/${ghUsername}/${ghRepo}.git`;
const ghPushUrl = `https://${ghUsername}:${ghToken}@github.com/${ghRepo}.git`;
const port = process.env.PORT;
const deployBranch = process.env.GH_DEPLOY_BRANCH;
const hooksBranch = process.env.GH_HOOKS_BRANCH;
const signatureHeader = "x-hub-signature";

function signData(secret: string, data: string) {
  return (
    "sha1=" +
    crypto
      .createHmac("sha1", secret)
      .update(data)
      .digest("hex")
  );
}

function verifySignature(secret: string, data: string, signature: string) {
  return (
    Buffer.compare(
      new Buffer(signature),
      new Buffer(signData(secret, data))
    ) === 0
  );
}

const app = express();
app.use(bodyParser.json());

let isProcessing = false;

app.post("/github/push", async function(req, res) {
  if (isProcessing) {
    res.status(502).json({ message: "Service is busy" });
    return;
  }

  if (
    secret &&
    !verifySignature(secret, JSON.stringify(req.body), (req.headers[
      signatureHeader
    ] || "") as string)
  ) {
    console.error("Failed to verify signature");
    return;
  }

  if (req.body.ref !== `refs/heads/${hooksBranch}`) {
    console.info(`Ignoring ref ${req.body.ref}`);
    return;
  }

  isProcessing = true;
  exec(
    `
      rm -rf ${ghRepo}
      git clone ${ghRepoUrl}
      cd ${ghRepo}
      git checkout ${hooksBranch}
      npm i
      npm run build
    `,
    err => {
      isProcessing = false;
      if (err) {
        console.error(err);
      }
    }
  );

  res.json(req.body);
});

app.listen(port);
