import * as dotenv from "dotenv";
import * as crypto from "crypto";
import * as express from "express";
import * as bodyParser from "body-parser";
import { exec, ExecException } from "child_process";

dotenv.config();

const secret = process.env.SECRET;
const repo = process.env.REPO;
const ghUrl = `https://${process.env.GH_USERNAME}:${process.env.GH_TOKEN}@github.com/${repo}.git`;
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

const execCb = (error: ExecException | null) => {
  if (error) {
    console.error(error);
  }
};

app.post("/github/push", function(req, res) {
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

  exec(`rm -rf ${repo}`, execCb);
  exec(`git clone ${ghUrl}`, execCb);
  exec(`cd ${repo}`, execCb);
  exec(`npm i`, execCb);
  exec(`npm run build`, execCb);

  res.json(req.body);
});

app.listen(port);
