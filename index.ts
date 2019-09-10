import * as dotenv from "dotenv";
import * as crypto from "crypto";
import * as express from "express";
import * as bodyParser from "body-parser";
import { exec, ExecException } from "child_process";

dotenv.config();

const secret = process.env.SECRET;
const repo = process.env.REPO;
const ghRepoUrl = `https://github.com/${repo}.git`;
const ghPushUrl = `https://${process.env.GH_USERNAME}:${process.env.GH_TOKEN}@github.com/${repo}.git`;
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

const execAsync = (cmd: string) =>
  new Promise((resolve, reject) =>
    exec(cmd, err => {
      if (err) {
        reject(err);
      }

      resolve();
    })
  );

app.post("/github/push", async function(req, res) {
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

  try {
    await execAsync(`rm -rf ${repo}`);
    await execAsync(`git clone ${ghRepoUrl} && git checkout ${hooksBranch}`);
    await execAsync(`cd ${repo}`);
    await execAsync(`npm i`);
    await execAsync(`npm run build`);
  } catch (err) {
    console.error(err);
  }

  res.json(req.body);
});

app.listen(port);
